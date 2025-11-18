import { RorMenu } from './RorMenu';
import { SecuritySettings } from './SecuritySettings';

export class TestSettings {
  static open() {
    cy.log('Open Test ACL');
    RorMenu.openRorMenu();
    RorMenu.openEditSecuritySettings();
    cy.intercept('GET', '/pkp/api/test').as('getTestSettings');
    TestSettings.clickTestSettingsTab();
    cy.wait('@getTestSettings').then(({ response }) => {
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
    cy.intercept('GET', '/pkp/api/settings').as('loadCurrentSettings');
    TestSettings.pressLoadCurrentSettingsButton();
    cy.wait('@loadCurrentSettings').then(({ response }) => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static pressInvalidateFileTestSettings() {
    cy.log('Press invalidate file Test ACL');
    cy.intercept('DELETE', '/pkp/api/test').as('invalidateTestSettings');
    cy.intercept('GET', '/pkp/api/settings/file').as('getTestSettings');
    SecuritySettings.getIframeBody()
      .findByRole('button', { name: /Deactivate/ })
      .click();
    cy.wait('@invalidateTestSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
    cy.wait('@getTestSettings').then(({ response }) => {
      expect([200, 304]).to.include(response.statusCode);
    });

    SecuritySettings.getIframeBody()
      .findByRole('button', { name: /Deactivate/ })
      .should('be.disabled');
    SecuritySettings.getIframeBody().contains('Your testing configuration is invalidated');
  }

  static pressSaveTestSettingsButton() {
    cy.log('Press save Test ACL button');
    cy.intercept('POST', '/pkp/api/test').as('postTestSettings');
    SecuritySettings.getIframeBody().contains('Save').click();
    cy.wait('@postTestSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
  }

  static pressPromoteAsPermanentButton() {
    cy.log('Press promote as permanent button');

    SecuritySettings.getIframeBody().contains('Promote as permanent').click();
  }

  static promoteAsPermanent() {
    cy.log('promote as permanent');
    cy.intercept('POST', '/pkp/api/settings').as('postSettings');
    cy.intercept('DELETE', '/pkp/api/test').as('invalidateTestSettings');
    cy.intercept('GET', '/pkp/api/settings/file').as('getTestSettings');
    TestSettings.pressPromoteAsPermanentButton();

    cy.wait('@postSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
    cy.wait('@invalidateTestSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
    cy.wait('@getTestSettings').then(({ response }) => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static successfulSaveTestSettingsToast() {
    cy.log('Successful save Test ACL toast');
    return SecuritySettings.getIframeBody().contains('Successfully saved Test ACL.');
  }

  static saveTestSettingsBeforePermanentPromote() {
    cy.log('Save Test ACL modal before permanent promote');

    cy.intercept('POST', '/pkp/api/test').as('postTestSettings');
    cy.intercept('POST', '/pkp/api/settings').as('postSettings');
    cy.intercept('DELETE', '/pkp/api/test').as('invalidateTestSettings');
    cy.intercept('GET', '/pkp/api/settings/file').as('getTestSettings');
    SecuritySettings.getIframeBody().find('[class=euiModalFooter]').contains('Save').click({ force: true });

    cy.wait('@postTestSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
    cy.wait('@postSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
    cy.wait('@invalidateTestSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
    cy.wait('@getTestSettings').then(({ response }) => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static saveTestSettingsBeforePermanentPromoteFailed() {
    cy.log('Save Test ACL modal before permanent promote failed');

    cy.intercept('POST', '/pkp/api/settings').as('postSettings');
    SecuritySettings.getIframeBody().find('[class=euiModalFooter]').contains('Reject').click({ force: true });

    cy.wait('@postSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
    // Settings.currentSettingsAlreadyLoadedToast().should('be.visible');
  }

  static rejectSaveTestSettingsBeforePermanentPromote() {
    cy.log('Reject save Test ACL modal before permanent promote');

    cy.intercept('POST', '/pkp/api/settings').as('postSettings');
    cy.intercept('DELETE', '/pkp/api/test').as('invalidateTestSettings');
    cy.intercept('GET', '/pkp/api/settings/file').as('getTestSettings');
    cy.log('Save Test ACL modal before permanent promote');
    SecuritySettings.getIframeBody().find('[class=euiModalFooter]').contains('Reject').click({ force: true });

    cy.wait('@postSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
    cy.wait('@invalidateTestSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
    cy.wait('@getTestSettings').then(({ response }) => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static loadChangesAnywayToast() {
    cy.log('Load changes anyway');
    return SecuritySettings.getIframeBody().contains('Load anyway').click();
  }

  static setDefaultData() {
    cy.log('Set default data');
    TestSettings.open();
    TestSettings.changeTtlValue('50', 'Seconds');
    TestSettings.loadCurrentSettings();
    TestSettings.pressSaveTestSettingsButton();
  }
}
