import * as yaml from 'js-yaml';
import { recurse } from 'cypress-recurse';

import { rorApiClient } from '../helpers/RorApiClient';
import { RorMenu } from './RorMenu';
import { SecuritySettings } from './SecuritySettings';
import { parseKbnSettings } from '../helpers/parseKibanaSettings';

export class Settings {
  private static readonly SAVE_MODAL_SETTLE_MS = 300;

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
    // The save click can occasionally land while the settings iframe is still catching up with a
    // just-established session (a transient "Forbidden" flashes and the confirmation modal never
    // mounts), so retry the Save click until "Save anyway" actually shows up instead of failing
    // after a single 20s wait.
    Settings.clickSaveButtonUntilModalAppears();
    SecuritySettings.getIframeBody().contains('Save anyway').click();
    cy.waitForResponse('@confirmSaveSettings').then(response => {
      expect(response.statusCode).to.eq(200);
    });
  }

  private static clickSaveButtonUntilModalAppears() {
    recurse(
      () =>
        cy
          .then(() => SecuritySettings.getIframeBody())
          .then($body => {
            // Once the modal is opening, an overlay mask covers the Save button; clicking again
            // would report the button as hidden instead of giving the modal time to finish
            // mounting. Only re-click while nothing has opened yet.
            const modalOpening = ($body as JQuery<HTMLElement>).find(':contains("Save anyway")').length > 0;
            if (!modalOpening) {
              Settings.clickSaveButton();
            }
          })
          .then(() => SecuritySettings.getIframeBody()),
      $body => ($body as JQuery<HTMLElement>).find(':contains("Save anyway")').length > 0,
      {
        delay: Settings.SAVE_MODAL_SETTLE_MS,
        timeout: 20000,
        // confirmSaveModal() asserts on the modal text right after this, so failing here would
        // only replace that message with a less specific one.
        doNotFail: true,
        log: false
      }
    );
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

  // An open Kibana page keeps sending requests with the tenancy of the old settings. When the new
  // settings do not match that tenancy, ES forbids the requests and Kibana stops with a fatal error.
  // Cypress then fails the hook that runs. Unloading the page first means no request uses the old tenancy.
  static restoreDefaultSettingsData() {
    cy.window({ log: false }).then(win => {
      win.location.href = 'about:blank';
    });
    Settings.setSettingsData('defaultReadonlyRestEsAndKbnSettings.yaml');
  }

  static setReadonlyRestKbnSettings(readonlyRestKbnSettings = '') {
    cy.fixture('defaultReadonlyRestEsSettings.yaml').then(esYamlSettings => {
      const merged = {
        ...(yaml.load(esYamlSettings) as object),
        readonlyrest_kbn: {
          cookiePass: '12312313123213123213123adadasdasdasd',
          // elk-ror runs 2 kbn-ror replicas behind kbn-proxy's round robin. Without index-backed
          // sessions, each node keeps sessions in memory, so a login on one replica isn't
          // recognized by the other and the next request bounces back to /login.
          store_sessions_in_index: true,
          ...parseKbnSettings(readonlyRestKbnSettings)
        }
      };
      rorApiClient.configureRorIndexMainSettings(yaml.dump(merged));
    });
  }
}
