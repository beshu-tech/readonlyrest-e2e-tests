import { Login } from '../support/page-objects/Login';
import { Settings } from '../support/page-objects/Settings';
import { Editor } from '../support/page-objects/Editor';

describe.skip('settings', () => {
  beforeEach(() => {
    Login.initialization();
    Settings.open();
    Settings.reloadFromFileSettings();
  });

  it('should check settings', () => {
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
    Settings.saveFileSettings();
    // Settings.malformedSavedConfigurationToast().should('be.visible');

    cy.log('should check save changes functionality when success');
    Editor.replaceValues('PERSONAL_GRP', `PERSONAL_GRP${Cypress._.random(0, 1e6)}`);
    Settings.saveFileSettings();
    // Settings.successfulSavedConfigurationToast().should('be.visible');
  });
});
