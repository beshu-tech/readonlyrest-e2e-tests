import { interceptNext } from '../helpers/interceptNext';
import { rorApiClient } from '../helpers/RorApiClient';
import { SecuritySettings } from './SecuritySettings';
import { stopApp } from '../helpers';

export class Settings {
  static open() {
    SecuritySettings.openTab('settings');
  }

  static pressReloadFromFileSettingsButton() {
    SecuritySettings.getIframeBody().contains('Reload from file').click();
  }

  static discardChanges() {
    cy.log('Discard changes');
    const getSettings = interceptNext('getSettings', { method: 'GET', url: '/pkp/api/settings' });
    Settings.waitForToastAfter('Reloaded configuration', () => {
      SecuritySettings.getIframeBody().contains('Discard changes').click();
      cy.waitForResponse(getSettings).then(response => {
        expect([200, 304]).to.include(response.statusCode);
      });
    });
  }

  static reloadFromFileSettings() {
    cy.log('Press reload from file test settings');
    const getSettingsFile = interceptNext('getSettingsFile', { method: 'GET', url: '/pkp/api/settings/file' });
    Settings.waitForToastAfter(Settings.LOADED_FROM_FILE_TOAST, () => {
      Settings.pressReloadFromFileSettingsButton();
      cy.waitForResponse(getSettingsFile).then(response => {
        expect([200, 304]).to.include(response.statusCode);
      });
    });
  }

  static clickSaveButton() {
    cy.log('Save file settings');
    cy.intercept('POST', '/pkp/api/settings').as('saveSettings');
    SecuritySettings.getIframeBody().contains('Save').click();
    cy.waitForResponse('@saveSettings').then(response => {
      expect(response.statusCode).to.eq(200);
    });
  }

  static closeToastMessages() {
    cy.log('Close toast messages');
    const closeButtons = '[data-test-subj=toastCloseButton]';
    SecuritySettings.getIframeBody().then(body => {
      Cypress.$(body as HTMLElement)
        .find(closeButtons)
        .each((_, button) => button.click());
    });
    SecuritySettings.getIframeBody().find(closeButtons).should('not.exist');
  }

  static readonly LOADED_FROM_FILE_TOAST = 'Loaded default ACL from readonlyrest.yml';

  // The answer of a load reaches Cypress before the app applies it to the form. The app sets the
  // form state and then shows a toast, so a step that needs the new state (for example a second load
  // that must ask before it overwrites changes) waits for that toast. Old toasts go first, so an old
  // toast with the same title does not pass the check.
  static waitForToastAfter(title: string, action: () => void) {
    Settings.closeToastMessages();
    action();
    SecuritySettings.getIframeBody().contains(title).should('exist');
  }

  static unsavedChangesModalVisible() {
    cy.log('unsaved changes modal visible');
    return SecuritySettings.getIframeBody().contains('Changes not saved');
  }

  static reloadChangesAnywayToast() {
    cy.log('Reload changes anyway');
    return SecuritySettings.getIframeBody().contains('Reload anyway').click();
  }

  // For an after hook. A settings change can end the group of the tenancy of a page that still
  // loads. Its tenancy-context-injector.js then never answers (RORDEV-2309), and Cypress fails the
  // hook on the page load timeout. So the page goes first.
  static restoreDefaultSettings() {
    stopApp();
    Settings.setSettingsData('defaultSettings.yaml');
  }

  static setSettingsData(fixtureYamlSettingsFileName: string) {
    cy.log('Set settings data from file ' + fixtureYamlSettingsFileName);
    rorApiClient.configureRorIndexMainSettings(fixtureYamlSettingsFileName);
  }
}
