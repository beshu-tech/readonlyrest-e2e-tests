import { recurse } from 'cypress-recurse';
import { KibanaNavigation } from './KibanaNavigation';
import { kibanaVersion, pasteText } from '../helpers';

export class DevTools {
  static openDevTools() {
    cy.log('Open Dev tools');
    if (kibanaVersion.gte('8.16.0') && kibanaVersion.lt('9.2.0')) {
      DevTools.markConsoleTourAsDone();
    }
    KibanaNavigation.openPage('Dev Tools');

    if (kibanaVersion.lt('8.16.0')) {
      cy.get('[data-test-subj="help-close-button"]').click();
    }
  }

  // Kibana 8.16 to 9.1 opens the Console with a tour. One navigation can mount the Console two or three
  // times, and each mount shows its own tour, so a "Skip tour" click can find more than one button.
  // The Console reads this key when it mounts, and a done tour shows no popover.
  private static markConsoleTourAsDone() {
    cy.window().then(win => {
      win.localStorage.setItem(
        'consoleTour',
        JSON.stringify({
          currentTourStep: 1,
          isTourActive: false,
          tourPopoverWidth: 360,
          tourSubtitle: 'Console onboarding'
        })
      );
    });
  }

  // Sends the request from the Console and checks the ES status of its answer.
  static sendRequest(request: string, statusCode: number, statusText: string) {
    cy.log(`Send request, expect ${statusCode}`);
    const [method, path] = request.split('\n')[0].trim().split(/\s+/);
    const exactly = (text: string) => new RegExp(`^${Cypress._.escapeRegExp(text)}$`);
    // The Console also sends its own requests through this proxy, for example the autocomplete
    // loads on Kibana 7, so the route matches only the method and path of this request. `times: 1`
    // gives each request its own route: routes with the same alias all count a request they match.
    cy.intercept({
      method: 'POST',
      pathname: '/s/default/api/console/proxy',
      query: { method: exactly(method), path: exactly(path) },
      times: 1
    }).as('consoleRequest');
    DevTools.trySendRequest(request);
    cy.wait('@consoleRequest').then(({ request: sent, response }) => {
      // Kibana 8 and later answers the proxy call with 200 and gives the ES status in a header, so
      // that an ES 401 does not open the browser login prompt. Kibana 7 answers with the ES status.
      const status = Number(response?.headers['x-console-proxy-status-code'] ?? response?.statusCode);
      const body = JSON.stringify(sent.body ?? '').slice(0, 100);
      expect(status, `ES status of ${method} ${path}, body ${body}`).to.equal(statusCode);
    });
    cy.contains(`${statusCode} - ${statusText}`).should('be.visible');
  }

  // Enters the request and clicks send. The Console does not send a request with errors.
  static trySendRequest(request: string) {
    if (kibanaVersion.gte('8.16.0')) {
      DevTools.enterRequestIntoMonacoEditor(request);
      cy.get('[data-test-subj="sendRequestButton"]').click();
    } else if (kibanaVersion.lte('7.9.0')) {
      cy.get('#ConAppEditor').click();
      cy.get('#ConAppInputTextarea').clear({ force: true });
      DevTools.pasteIntoFocusedEditor(request);

      // Click play
      cy.get('.ace_scroller:nth-child(4) > .ace_content').click({ force: true });
      cy.get('.conApp__editorActionButton path').click({ force: true });
    } else {
      cy.get('[data-test-subj=console-textarea]').focus().clear({ force: true });
      DevTools.pasteIntoFocusedEditor(request);
      cy.get('[data-test-subj=sendRequestButton]').click();
    }
  }

  // Kibana 8.16 to 9.1 can mount the Console again after it shows (RORDEV-2282). The new mount
  // replaces the editor and fills it with its start text, so a request entered before that is lost
  // or lands inside the start text. So the request goes in again until the editor holds only it.
  // The paste goes to the textarea of the editor that shows now, not to the focused element: a new
  // mount between a click and the paste removes the textarea that had the focus, and then no element
  // has it.
  private static enterRequestIntoMonacoEditor(request: string, attempt = 1) {
    cy.get('[data-test-subj="clearConsoleInput"]').click();
    DevTools.monacoTextarea()
      .focus()
      .then($textarea => pasteText($textarea[0], request));
    // Monaco draws the pasted lines on a later frame, so the check polls for up to 2 s.
    recurse(
      () => DevTools.monacoEditorText(),
      text => text === request,
      { limit: 20, delay: 100, doNotFail: true, yield: 'value', log: false }
    ).then(text => {
      if (text !== request) {
        DevTools.enterRequestAgain(request, attempt, text);
        return;
      }
      // The send button shows only while the editor has the focus. A new mount can also come after
      // the check above, so the text is read again after the focus.
      DevTools.monacoTextarea().focus();
      DevTools.monacoEditorText().then(textBeforeSend => {
        if (textBeforeSend !== request) {
          DevTools.enterRequestAgain(request, attempt, textBeforeSend);
          return;
        }
        DevTools.enterRequestAgainIfSendButtonHidden(request, attempt);
      });
    });
  }

  // A debounced handler of the cursor, scroll and content events shows the send button, and only
  // while the editor has the text focus. A new mount after the paste gives no such event, so the
  // button stays hidden. The paste of the next attempt is such an event. On the last attempt the
  // click reports the hidden button.
  private static enterRequestAgainIfSendButtonHidden(request: string, attempt: number) {
    const isVisible = ($button: JQuery<HTMLElement>) => Cypress.dom.isVisible($button[0]);
    recurse(() => cy.get('[data-test-subj="sendRequestButton"]', { log: false }), isVisible, {
      limit: 20,
      delay: 100,
      doNotFail: true,
      yield: 'value',
      log: false
    }).then($button => {
      if (!isVisible($button) && attempt < DevTools.ENTER_ATTEMPTS) {
        DevTools.enterRequestIntoMonacoEditor(request, attempt + 1);
      }
    });
  }

  private static enterRequestAgain(request: string, attempt: number, text: string) {
    if (attempt < DevTools.ENTER_ATTEMPTS) {
      DevTools.enterRequestIntoMonacoEditor(request, attempt + 1);
    } else {
      expect(text, 'Console editor text').to.equal(request);
    }
  }

  private static readonly ENTER_ATTEMPTS = 3;

  private static monacoTextarea() {
    return cy.get('[data-test-subj="consoleMonacoEditor"] textarea');
  }

  // Monaco positions its line elements; their DOM order is not the line order.
  private static monacoEditorText() {
    return cy.get('[data-test-subj="consoleMonacoEditor"] .view-line').then($lines =>
      $lines
        .toArray()
        .sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top))
        .map(line => line.innerText.replace(/\u00a0/g, ' ').trimEnd())
        .join('\n')
    );
  }

  // The Console autocomplete reacts to typed keys. A space asks for suggestions, and an Enter
  // while they show accepts one: typed keys can give `POST /index/_doc GET { ... }`. A paste is
  // one edit with no keys, so the editor gets the request as it is.
  private static pasteIntoFocusedEditor(text: string) {
    cy.focused().then($input => pasteText($input[0], text));
  }

  static verifyIfContainsErrorsMessage() {
    cy.log('Verify if contains errors message');
    cy.contains(
      '[data-test-subj="globalToastList"]',
      'The selected request contains errors. Please resolve them and try again.'
    ).should('be.visible');
  }

  static verifyResponseInConsole(value: string) {
    cy.log('verify response in console');

    if (kibanaVersion.gte('8.0.0')) {
      cy.contains('[data-test-subj="consoleMonacoOutput"]', value);
    } else {
      cy.contains('[data-test-subj="response-editor"]', value);
    }
  }
}
