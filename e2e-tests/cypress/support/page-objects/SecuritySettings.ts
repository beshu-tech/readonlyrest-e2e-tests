import { getIframeBody } from '../helpers/iframe';
import { RorMenu } from './RorMenu';

const IFRAME = '#readonlyrestIframe';

// The tab ids of the ReadonlyREST app in the iframe.
export type SecuritySettingsTab =
  | 'settings'
  | 'test_settings'
  | 'impersonate'
  | 'activation_keys'
  | 'interactive_api'
  | 'user_Settings';

export class SecuritySettings {
  static getIframeBody = () => getIframeBody(IFRAME);

  // One query chain from the iframe element, so that each retry reads the current document. Until the
  // app loads, the iframe holds an empty document, and a body taken from it never gets the tabs.
  static tab(id: SecuritySettingsTab) {
    return cy.get(IFRAME).its('0.contentDocument.body').find(`.euiTabs #${id}`);
  }

  static openTab(id: SecuritySettingsTab) {
    cy.log(`Open the ${id} tab of the security settings`);
    RorMenu.openRorMenu();
    RorMenu.openEditSecuritySettings();
    SecuritySettings.tab(id).click();
  }

  static checkActiveTab(tab: string) {
    SecuritySettings.getIframeBody().findByRole('tab', { name: tab, selected: true }).should('be.visible');
  }
}
