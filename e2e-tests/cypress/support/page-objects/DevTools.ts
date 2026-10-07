import * as semver from 'semver';
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

  static sendRequest(text: string) {
    cy.log('Send request');
    cy.intercept({ method: 'POST', pathname: '/s/default/api/console/proxy' }).as('sendRequest');
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      cy.get('[data-test-subj="clearConsoleInput"]').click();
      cy.get('[data-test-subj="consoleMonacoEditor"]').click().type(text);
      cy.get('[data-test-subj="sendRequestButton"]').click();
    } else if (semver.lte(getKibanaVersion(), '7.9.0')) {
      // Select editor, delete, write
      cy.get('#ConAppEditor').click();
      cy.get('#ConAppInputTextarea').clear({ force: true });
      cy.get('#ConAppInputTextarea').type(text);

      // Click play
      cy.get('.ace_scroller:nth-child(4) > .ace_content').click({ force: true });
      cy.get('.conApp__editorActionButton path').click({ force: true });
    } else {
      cy.get('[data-test-subj=console-textarea]').focus().clear({ force: true });
      cy.get('[data-test-subj=console-textarea]').focus().type(text, { force: true });
      cy.get('[data-test-subj=sendRequestButton]').click();
    }
    cy.wait('@sendRequest');
  }

  static verifyIf200Status() {
    cy.log('verify if 200 status');
    cy.contains('200 - OK').should('be.visible');
  }

  static verifyIf400Status() {
    cy.log('verify if 400 status');
    cy.contains('400 - Bad Request').should('be.visible');
  }

  static verifyIf403Status() {
    cy.log('verify if 403 status');
    cy.contains('403 - Forbidden').should('be.visible');
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
