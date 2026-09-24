import * as semver from 'semver';
import { KibanaNavigation } from './KibanaNavigation';
import { getKibanaVersion } from '../helpers';

export class DevTools {
  static openDevTools() {
    cy.log('Open Dev tools');
    KibanaNavigation.openKibanaNavigation();
    cy.contains('Dev Tools').click();

    if (semver.lt(getKibanaVersion(), '9.2.0')) {
      if (semver.gte(getKibanaVersion(), '8.16.0')) {
        // Cypress actionability checks flag this button as "covered" by its own text label
        // (`<span class="euiButtonEmpty__text">`) - a false positive, not a real overlay -
        // so force the click instead of waiting out a cover that will never clear.
        cy.get("[data-test-subj='consoleSkipTourButton']").click({ force: true });
      } else {
        cy.get('[data-test-subj="help-close-button"]').click();
      }
    }
  }

  static sendRequest(text: string) {
    cy.log('Send request');
    cy.intercept({ method: 'POST', pathname: '/s/default/api/console/proxy' }).as('sendRequest');
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      cy.get('[data-test-subj="clearConsoleInput"]').click();
      // Monaco mounts its hidden input textarea asynchronously after the container appears;
      // typing before it exists lands on the static "view-lines" rendering div instead, which
      // isn't a typeable element and throws. Wait for the real input to exist first.
      cy.get('[data-test-subj="consoleMonacoEditor"] textarea.inputarea').should('exist');
      // The console's action-icon toolbar (euiFlexGroup) can overlap the editor while it settles.
      // That cover is real and clears on its own, so let Cypress's actionability retry (bounded by
      // defaultCommandTimeout) wait it out instead of forcing past it and risking a swallowed click.
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
