import { RorMenu } from './RorMenu';
import { SecuritySettings } from './SecuritySettings';

export class Settings {
  static open() {
    cy.log('Open settings');
    RorMenu.openRorMenu();
    RorMenu.openEditSecuritySettings();
    SecuritySettings.getIframeBody().find('#settings').click();
  }

  static pressReloadFromFileSettingsButton() {
    SecuritySettings.getIframeBody().contains('Reload from file').click();
  }

  static discardChanges() {
    cy.log('Discard changes');
    cy.intercept('GET', '/pkp/api/settings').as('getSettings');
    SecuritySettings.getIframeBody().contains('Discard changes').click();
    cy.wait('@getSettings').then(({ response }) => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static reloadFromFileSettings() {
    cy.log('Press reload from file test settings');
    cy.intercept('GET', '/pkp/api/settings/file').as('reloadFromFileSettings');
    Settings.pressReloadFromFileSettingsButton();
    cy.wait('@reloadFromFileSettings').then(({ response }) => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static saveFileSettings() {
    cy.log('Save file settings');
    cy.intercept('POST', '/pkp/api/settings').as('saveSettings');
    SecuritySettings.getIframeBody().contains('Save').click();
    cy.wait('@saveSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
  }

  static closeToastMessages() {
    cy.log('Close toast message');
    return SecuritySettings.getIframeBody()
      .find('[data-test-subj=toastCloseButton]')
      .each($el => {
        $el[0].click();
      });
  }

  static unsavedChangesModalVisible() {
    cy.log('unsaved changes modal visible');
    return SecuritySettings.getIframeBody().contains('Changes not saved');
  }

  static reloadChangesAnywayToast() {
    cy.log('Reload changes anyway');
    return SecuritySettings.getIframeBody().contains('Reload anyway').click();
  }

  static successfulLoadFromFileToast() {
    cy.log('Successful load from file toast');
    return SecuritySettings.getIframeBody().contains('Loaded default ACL from readonlyrest.yml');
  }

  static currentSettingsAlreadyLoadedToast() {
    cy.log('Current settings already loaded toast');
    return SecuritySettings.getIframeBody().contains('Current ACL are already loaded');
  }

  static successfulReloadConfigurationToast() {
    cy.log('Successful reload configuration toast');
    return SecuritySettings.getIframeBody().contains('Reloaded configuration');
  }

  static successfulSavedConfigurationToast() {
    cy.log('Successful saved configuration toast');
    return SecuritySettings.getIframeBody().contains('saved');
  }

  static malformedSavedConfigurationToast() {
    cy.log('Malformed saved configuration toast');
    return SecuritySettings.getIframeBody().contains('Malformed settings');
  }

  static setSettingsData(settings: Record<string, unknown>) {
    cy.log('Set settings data');
    cy.post({ url: `${Cypress.env().elasticsearchUrl}/_readonlyrest/admin/config`, payload: settings });
  }
}
