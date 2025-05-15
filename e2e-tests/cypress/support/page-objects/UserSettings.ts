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
    SecuritySettings.getIframeBody()
      .find(`[data-testid="${userSettings}"]`)
      .find(`[data-test-subj="${value}"]`)
      .click({ force: true });

    SecuritySettings.getIframeBody()
      .find(`[data-testid="${userSettings}"]`)
      .find(`[data-test-subj="${value}"]`)
      .should('be.checked');
  }
}
