import * as semver from 'semver';
import { KibanaNavigation } from './KibanaNavigation';
import { getKibanaVersion } from '../helpers';

export class DevTools {
  static openDevTools() {
    cy.log('Open Dev tools');
    KibanaNavigation.openKibanaNavigation();
    cy.contains('Dev Tools').click();
    cy.findByRole('button', {name: /Dismiss/});
    cy.findByRole('dialog')
      .findByRole('button', {name: /Dismiss/})
      .click();
  }

  static sendRequest(text: string) {
    cy.log('Send request');
    if (semver.lte(getKibanaVersion(), '7.9.0')) {
      // Select editor, delete, write
      cy.get('#ConAppEditor').click();
      cy.get('#ConAppInputTextarea').clear({force: true});
      cy.get('#ConAppInputTextarea').type(text);

      // Click play
      cy.get('.ace_scroller:nth-child(4) > .ace_content').click({force: true});
      cy.get('.conApp__editorActionButton path').click({force: true});
    } else {
      cy.get('[data-test-subj=console-textarea]').clear({force: true});
      cy.get('[data-test-subj=console-textarea]').type(text, {force: true, parseSpecialCharSequences: false});
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
}
