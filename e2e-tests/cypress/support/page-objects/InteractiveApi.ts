import { KibanaNavigation } from './KibanaNavigation';
import { RorMenu } from './RorMenu';
import { SecuritySettings } from './SecuritySettings';

export class InteractiveApi {
  static open() {
    cy.log('Open Interactive API');
    KibanaNavigation.openKibanaNavigation();
    RorMenu.openRorMenu();
    RorMenu.openEditSecuritySettings();
    InteractiveApi.clickInteractiveApiTab();
  }

  static clickInteractiveApiTab() {
    cy.log('Click Interactive API tab');
    SecuritySettings.getIframeBody().find('[class=euiTabs]').find('#interactive_api').click();
  }
}
