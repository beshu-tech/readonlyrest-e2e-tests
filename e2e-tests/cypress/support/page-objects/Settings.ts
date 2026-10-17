import * as yaml from 'js-yaml';
import { recurse } from 'cypress-recurse';
import { interceptNext } from '../helpers/interceptNext';
import { rorApiClient } from '../helpers/RorApiClient';
import { SecuritySettings } from './SecuritySettings';
import { parseKbnSettings } from '../helpers/parseKibanaSettings';
import { stopApp } from '../helpers';

export class Settings {
  private static readonly SAVE_MODAL_SETTLE_MS = 300;

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
    Settings.setSettingsData('defaultReadonlyRestEsAndKbnSettings.yaml');
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
