import { Login } from '../support/page-objects/Login';
import { Settings } from '../support/page-objects/Settings';
import { Editor } from '../support/page-objects/Editor';

describe('settings', () => {
  it('should check settings', () => {
    Login.initialization();
    Settings.open();
    Settings.reloadFromFileSettings();

    /**
     * TODO: Uncomment all toast based assertions and try to make this check non-deterministic
     */

    cy.log('should check reload from file settings functionality');
    // Settings.successfulLoadFromFileToast().should('be.visible');
    // Settings.closeToastMessages();
    // Settings.successfulLoadFromFileToast().should('not.be.visible');
    Settings.pressReloadFromFileSettingsButton();
    Settings.unsavedChangesModalVisible();
    Settings.reloadChangesAnywayToast();
    // Settings.successfulLoadFromFileToast().should('be.visible');

    cy.log('should check discard changes functionality');
    // Settings.successfulLoadFromFileToast().should('be.visible');
    // Settings.closeToastMessages();
    // Settings.successfulLoadFromFileToast().should('not.be.visible');
    Settings.discardChanges();
    // Settings.successfulReloadConfigurationToast().should('not.be.visible');

    cy.log('should check save changes functionality when no changes provided');
    // Settings.currentSettingsAlreadyLoadedToast().should('be.visible');

    cy.log('should check save changes functionality when malformed settings provided');
    Editor.changeConfig('readonlyrest:');
    Settings.clickSaveButton();
    // Settings.malformedSavedConfigurationToast().should('be.visible');

    cy.log('should check save changes functionality when success');
    Editor.replaceValues('PERSONAL_GRP', `PERSONAL_GRP${Cypress._.random(0, 1e6)}`);
    Settings.clickSaveButton();
    // Settings.successfulSavedConfigurationToast().should('be.visible');
  });

  it('should save settings and verify success response from request when user without group logging in', () => {
    const [username, password] = Cypress.env().kibanaUserCredentials.split(':');

    Login.initialization({ username, password });
    Settings.open();
    cy.intercept('POST', '/pkp/api/settings').as('saveSettings');
    Settings.clickSaveButton();

    cy.wait('@saveSettings').its('response.statusCode').should('equal', 200);
  });
});
