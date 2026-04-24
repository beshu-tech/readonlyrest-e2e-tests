import { RorMenu } from './RorMenu';
import { SecuritySettings } from './SecuritySettings';

export class UserSettings {
  static open() {
    cy.log('Open User settings');
    RorMenu.openRorMenu();
    RorMenu.openEditSecuritySettings();
    UserSettings.clickUserSettingsTab();
  }

  static clickUserSettingsTab() {
    cy.log('Click User settings tab');
    SecuritySettings.getIframeBody().find('[class=euiTabs]').find('#user_Settings').click();
  }

  static openViaMenuIcon() {
    cy.log('Open via menu icon');
    cy.get('[data-testid="user-settings-icon"]').click();

    SecuritySettings.waitForIframeContent();
  }

  static changeUserSettingsValue(userSettings: string, value: string) {
    cy.log('Change user settings value');

    SecuritySettings.getIframeBody().contains('ReadonlyREST User settings').should('be.visible');

    SecuritySettings.getIframeBody().find(`[data-testid="${userSettings}"]`).as('userSettingsElement');

    cy.get(`@userSettingsElement`).find(`[data-test-subj="${value}"]`).as('userSettingsValue').click({ force: true });

    cy.get('@userSettingsValue').should('be.checked');
  }
}
