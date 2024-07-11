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
}
