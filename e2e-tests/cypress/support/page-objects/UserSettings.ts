import { SecuritySettings } from './SecuritySettings';

export class UserSettings {
  static open() {
    SecuritySettings.openTab('user_Settings');
  }

  static openViaMenuIcon() {
    cy.log('Open via menu icon');
    cy.get('[data-testid="user-settings-icon"]').click();
    SecuritySettings.tab('user_Settings').should('exist');
  }

  static changeUserSettingsValue(userSettings: string, value: string) {
    cy.log('Change user settings value');

    SecuritySettings.getIframeBody().contains('ReadonlyREST User settings').should('be.visible');

    SecuritySettings.getIframeBody().find(`[data-testid="${userSettings}"]`).as('userSettingsElement');

    // EuiButtonGroup puts the test subject on a screen-reader-only radio input, which Cypress sees as
    // hidden. The label over it is the visible part, so the click on the input needs force.
    cy.get(`@userSettingsElement`).find(`[data-test-subj="${value}"]`).as('userSettingsValue').click({ force: true });

    cy.get('@userSettingsValue').should('be.checked');
  }
}
