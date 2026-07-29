import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { UserSettings } from '../support/page-objects/UserSettings';
import { SecuritySettings } from '../support/page-objects/SecuritySettings';
import { getKibanaVersion } from '../support/helpers';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Loader } from '../support/page-objects/Loader';

// Unhandled rejections Kibana itself emits while re-bootstrapping after the theme reload below.
// None of them are related to what these tests verify (that switching the theme loads the dark CSS
// and that the remember-group setting survives logout):
//
//  - ChunkLoadError / Loading chunk: 8.x lazily loads plugin chunks (securitySolution,
//    observability, enterpriseSearch) during the reload and some fail to arrive.
//  - executing a cancelled action: a plugin store flushes a queue whose actions were cancelled by
//    the in-flight remount.
//  - t.toUpperCase is not a function: thrown by Kibana core's own notifications service during
//    bootstrap, not by ROR.
//
// Registered with `Cypress.on` at spec scope, not `cy.on` inside a test: `cy.on` listeners are torn
// down when the test body ends, so a rejection arriving during the `afterEach` below would fail the
// hook and skip the rest of the suite. Spec scope covers hooks while keeping the suppression out of
// every other spec.
Cypress.on('uncaught:exception', err => {
  if (
    err.message.includes('ChunkLoadError') ||
    err.message.includes('Loading chunk') ||
    err.message.includes('executing a cancelled action') ||
    err.message.includes('toUpperCase is not a function')
  ) {
    return false;
  }
});

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

    // Register the intercept before triggering any reload so we don't miss the CSS request
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      cy.intercept('**/*legacy_dark_theme.min.css').as('darkMode');
    } else {
      cy.intercept('**/*dark.css').as('darkMode');
    }

    SecuritySettings.getIframeBody().find('[data-test-subj="dark"]').click({ force: true });
    SecuritySettings.getIframeBody().find('button').contains('Reload page').click({ force: true });

    cy.reload();

    cy.wait('@darkMode');

    // The dark-theme CSS lands long before Kibana finishes mounting. Ending the test here would
    // leave teardown racing a half-built app.
    Loader.settled();
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
    cy.url().should('include', `tenancy%3D`);
    Login.fillLoginPageWith(Cypress.env().login, Cypress.env().password);
    Loader.loading();
    RorMenu.openRorMenu();
    RorMenu.verifyCurrentTenant(selectedTenant);

    cy.log('Verify remember group after logout disabled');
    UserSettings.openViaMenuIcon();
    UserSettings.changeUserSettingsValue('remember-group-after-logout-settings', 'disabled');
    RorMenu.openRorMenu();
    RorMenu.pressLogoutButton();
    cy.url().should('not.include', `tenancy%3D`);
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
