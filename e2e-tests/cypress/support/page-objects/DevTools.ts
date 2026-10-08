import * as semver from 'semver';
import type { Interception } from 'cypress/types/net-stubbing';
import { recurse } from 'cypress-recurse';
import { KibanaNavigation } from './KibanaNavigation';
import { getKibanaVersion } from '../helpers';

export class DevTools {
  static openDevTools() {
    cy.log('Open Dev tools');
    if (semver.gte(getKibanaVersion(), '8.16.0') && semver.lt(getKibanaVersion(), '9.2.0')) {
      DevTools.markConsoleTourAsDone();
    }
    KibanaNavigation.openKibanaNavigation();
    cy.contains('Dev Tools').click();

    if (semver.lt(getKibanaVersion(), '8.16.0')) {
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

  // Sends the request from the Console and waits for its answer.
  static sendRequest(request: string) {
    cy.log('Send request');
    // `times: 1` gives each request its own route. Routes with the same alias all count a request
    // they match, so with more routes a later cy.wait() can yield the answer of an earlier request.
    cy.intercept({ method: 'POST', pathname: '/s/default/api/console/proxy', times: 1 }).as('consoleRequest');
    DevTools.trySendRequest(request);
    cy.wait('@consoleRequest');
  }

  // Enters the request and clicks send. The Console does not send a request with errors.
  static trySendRequest(request: string) {
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      DevTools.enterRequestIntoMonacoEditor(request);
      cy.get('[data-test-subj="sendRequestButton"]').click();
    } else if (semver.lte(getKibanaVersion(), '7.9.0')) {
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
  private static enterRequestIntoMonacoEditor(request: string, attempt = 1) {
    cy.get('[data-test-subj="clearConsoleInput"]').click();
    cy.get('[data-test-subj="consoleMonacoEditor"]').click();
    DevTools.pasteIntoFocusedEditor(request);
    // Monaco draws the pasted lines on a later frame, so the check polls for up to 2 s.
    recurse(
      () => DevTools.monacoEditorText(),
      text => text === request,
      { limit: 20, delay: 100, doNotFail: true, yield: 'value', log: false }
    ).then(text => {
      if (text !== request && attempt < DevTools.ENTER_ATTEMPTS) {
        DevTools.enterRequestIntoMonacoEditor(request, attempt + 1);
      } else {
        expect(text, 'Console editor text').to.equal(request);
      }
    });
  }

  private static readonly ENTER_ATTEMPTS = 3;

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
    cy.focused().then($input => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      $input[0].dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    });
  }

  static verifyResponseStatus(statusCode: number, statusText: string) {
    cy.log(`verify ${statusCode} status`);
    cy.get<Interception>('@consoleRequest').then(({ request, response }) => {
      // Kibana 8 and later answers the proxy call with 200 and gives the ES status in a header, so
      // that an ES 401 does not open the browser login prompt. Kibana 7 answers with the ES status.
      const status = Number(response?.headers['x-console-proxy-status-code'] ?? response?.statusCode);
      const query = new URL(request.url).searchParams;
      const body = JSON.stringify(request.body ?? '').slice(0, 100);
      expect(status, `ES status of ${query.get('method')} ${query.get('path')}, body ${body}`).to.equal(statusCode);
    });
    cy.contains(`${statusCode} - ${statusText}`).should('be.visible');
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

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.contains('[data-test-subj="consoleMonacoOutput"]', value);
    } else {
      cy.contains('[data-test-subj="response-editor"]', value);
    }
  }
}
