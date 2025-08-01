import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { UserSettings } from '../support/page-objects/UserSettings';
import { SecuritySettings } from '../support/page-objects/SecuritySettings';
import { getKibanaVersion } from '../support/helpers';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Loader } from '../support/page-objects/Loader';

describe('User settings', () => {
  beforeEach(() => {
    Login.initialization();
  });

  afterEach(() => {
    cy.clearCookies();
  });

  it('should verify user settings change', () => {
    cy.log('Change theme');
    UserSettings.open();
    SecuritySettings.getIframeBody().find('[data-test-subj="dark"]').click({ force: true });
    SecuritySettings.getIframeBody().find('button').contains('Reload page').click({ force: true });
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      cy.intercept('**/*legacy_dark_theme.min.css').as('darkMode');
    } else {
      cy.intercept('**/*dark.css').as('darkMode');
    }

    cy.reload();

    cy.wait('@darkMode');
  });

  it('should verify remember group after logout enabled', () => {
    const selectedTenant = 'infosec';

    cy.log('Verify remember group after logout enabled');
    RorMenu.changeTenancy(selectedTenant);
    RorMenu.openRorMenu();
    UserSettings.openViaMenuIcon();
    UserSettings.changeUserSettingsValue('remember-group-after-logout-settings', 'enabled');
    RorMenu.openRorMenu();
    RorMenu.pressLogoutButton();
    cy.url().should('include', `nextGroup=`);
    Login.fillLoginPageWith(Cypress.env().login, Cypress.env().password);
    Loader.loading();
    RorMenu.openRorMenu();
    RorMenu.verifyCurrentTenant(selectedTenant);

    cy.log('Verify remember group after logout disabled');
    UserSettings.openViaMenuIcon();
    UserSettings.changeUserSettingsValue('remember-group-after-logout-settings', 'disabled');
    RorMenu.openRorMenu();
    RorMenu.pressLogoutButton();
    cy.url().should('not.include', `nextGroup=`);
    Login.fillLoginPageWith(Cypress.env().login, Cypress.env().password);
    Loader.loading();
    RorMenu.openRorMenu();
    RorMenu.verifyCurrentTenant('administrators');
  });

  it('should not switch group to the remember one when the group is not available for the logged in user', () => {
    RorMenu.changeTenancy('infosec');
    RorMenu.openRorMenu();
    UserSettings.openViaMenuIcon();
    UserSettings.changeUserSettingsValue('remember-group-after-logout-settings', 'enabled');
    RorMenu.openRorMenu();
    RorMenu.pressLogoutButton();
    Login.fillLoginPageWith('kibana', 'kibana');
    Loader.loading();
    RorMenu.openRorMenu();
    RorMenu.verifyNoTenantAvailable();
  });
});
