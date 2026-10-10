import { interceptNext } from '../helpers/interceptNext';
import { RorMenu } from './RorMenu';
import { SecuritySettings } from './SecuritySettings';

export class TestSettings {
  static open() {
    cy.log('Open Test ACL');
    RorMenu.openRorMenu();
    RorMenu.openEditSecuritySettings();
    const getTestSettings = interceptNext('getTestSettings', { method: 'GET', url: '/pkp/api/test' });
    TestSettings.clickTestSettingsTab();
    cy.waitForResponse(getTestSettings).then(response => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static clickTestSettingsTab() {
    cy.log('Click Test ACL');
    SecuritySettings.waitForIframeContent();
    SecuritySettings.getIframeBody()
      .findByRole('tab', { name: /test acl/i })
      .click();
  }

  static changeTtlValue(time: string, unit: 'Seconds' | 'Minutes' | 'Hours' | 'Days' = 'Minutes') {
    cy.log('Change ttl value');
    SecuritySettings.getIframeBody().find('[data-testid=ttl-field]').clear().type(time);
    SecuritySettings.getIframeBody().find('[data-testid=ttl-unit]').select(unit);
  }

  static pressLoadCurrentSettingsButton() {
    cy.log('Press load current settings button');
    SecuritySettings.getIframeBody().contains('Load current').click();
  }

  static loadCurrentSettings() {
    cy.log('Load current settings');
    const getSettings = interceptNext('getSettings', { method: 'GET', url: '/pkp/api/settings' });
    TestSettings.pressLoadCurrentSettingsButton();
    cy.waitForResponse(getSettings).then(response => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static pressInvalidateFileTestSettings() {
    cy.log('Press invalidate file Test ACL');
    const deleteTestSettings = interceptNext('deleteTestSettings', { method: 'DELETE', url: '/pkp/api/test' });
    const getTestSettings = interceptNext('getTestSettings', { method: 'GET', url: '/pkp/api/test' });
    SecuritySettings.getIframeBody()
      .findByRole('button', { name: /Deactivate/ })
      .click();
    cy.waitForResponse(deleteTestSettings).then(response => {
      expect(response.statusCode).to.eq(200);
    });
    cy.waitForResponse(getTestSettings).then(response => {
      expect([200, 304]).to.include(response.statusCode);
    });

    SecuritySettings.getIframeBody()
      .findByRole('button', { name: /Deactivate/ })
      .should('be.disabled');
    SecuritySettings.getIframeBody().contains('Your testing configuration is invalidated');
  }

  static pressSaveTestSettingsButton() {
    cy.log('Press save Test ACL button');
    const postTestSettings = interceptNext('postTestSettings', { method: 'POST', url: '/pkp/api/test' });
    SecuritySettings.getIframeBody().contains('Save').click();
    cy.waitForResponse(postTestSettings).then(response => {
      expect(response.statusCode).to.eq(200);
    });
  }

  static loadChangesAnywayToast() {
    cy.log('Load changes anyway');
    return SecuritySettings.getIframeBody().contains('Load anyway').click();
  }

  static setDefaultData() {
    cy.log('Set default data');
    TestSettings.open();
    // Long enough for a slow test: an ACL that expires mid-test changes the page the test clicks.
    TestSettings.changeTtlValue('10', 'Minutes');
    TestSettings.loadCurrentSettings();
    TestSettings.pressSaveTestSettingsButton();
  }
}
