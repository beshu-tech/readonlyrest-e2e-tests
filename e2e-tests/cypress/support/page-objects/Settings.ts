import * as yaml from 'js-yaml';

import { rorApiClient } from '../helpers/RorApiClient';
import { RorMenu } from './RorMenu';
import { SecuritySettings } from './SecuritySettings';
import { parseKbnSettings } from '../helpers/parseKibanaSettings';

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
    cy.waitForResponse('@getSettings').then(response => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static reloadFromFileSettings() {
    cy.log('Press reload from file test settings');
    cy.intercept('GET', '/pkp/api/settings/file').as('reloadFromFileSettings');
    Settings.pressReloadFromFileSettingsButton();
    cy.waitForResponse('@reloadFromFileSettings').then(response => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static clickSaveButton() {
    cy.log('Save file settings');

    SecuritySettings.getIframeBody().contains('Save').click();
  }

  static confirmSaveModal() {
    cy.log('Confirm settings save modal');
    cy.intercept('POST', '/pkp/api/settings*').as('confirmSaveSettings');
    SecuritySettings.getIframeBody().contains('Save anyway').click();
    cy.waitForResponse('@confirmSaveSettings').then(response => {
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

  static setSettingsData(fixtureYamlSettingsFileName: string) {
    cy.log(`Set settings data from file ${fixtureYamlSettingsFileName}`);
    rorApiClient.configureRorIndexMainSettingsFromFixture(fixtureYamlSettingsFileName);
  }

  static setReadonlyRestKbnSettings(readonlyRestKbnSettings = '') {
    cy.fixture('defaultReadonlyRestEsSettings.yaml').then(esYamlSettings => {
      const merged = {
        ...(yaml.load(esYamlSettings) as object),
        readonlyrest_kbn: {
          cookiePass: '12312313123213123213123adadasdasdasd',
          ...parseKbnSettings(readonlyRestKbnSettings)
        }
      };
      rorApiClient.configureRorIndexMainSettings(yaml.dump(merged));
    });
  }
}
