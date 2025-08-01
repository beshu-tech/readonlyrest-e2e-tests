import * as semver from 'semver';
import { KibanaNavigation } from './KibanaNavigation';
import { getKibanaVersion } from '../helpers';

export class DevTools {
  static openDevTools() {
    cy.log('Open Dev tools');
    KibanaNavigation.openKibanaNavigation();
    cy.contains('Dev Tools').click();

    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      cy.get("[data-test-subj='consoleSkipTourButton']").click();
    } else {
      cy.get('[data-test-subj="help-close-button"]').click();
    }
  }

  static sendRequest(text: string) {
    cy.log('Send request');
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
      cy.get('[data-test-subj=console-textarea]').clear({ force: true });
      cy.get('[data-test-subj=console-textarea]').type(text, { force: true });
      cy.get('[data-test-subj=sendRequestButton]').click();
    }
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

  static verifyIfRequestInProgress() {
    cy.log('Verify if request in progress');

    cy.contains('Request in progress');
  }
}
