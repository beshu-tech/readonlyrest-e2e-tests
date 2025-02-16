import { Login } from '../support/page-objects/Login';
import { Loader } from '../support/page-objects/Loader';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Discover } from '../support/page-objects/Discover';
import { Settings } from '../support/page-objects/Settings';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import * as semver from 'semver';
import { getKibanaVersion } from '../support/helpers';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';

describe('Reporting index', () => {
  const admin = 'admin:dev';

  beforeEach(() => {
    Settings.setSettingsData('reportingSettings.yaml');
    cy.visit(Cypress.config().baseUrl);
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreTrialInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
    Login.signIn();
    Loader.loading();
  });

  afterEach(() => {
    kbnApiAdvancedClient.deleteSavedObjects(admin, 'infosec_group');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      kbnApiAdvancedClient.deleteDataViews(admin, 'infosec_group');
    }
    Settings.setSettingsData('defaultSettings.yaml');
  });

  it('should correctly match index pattern when audit index_template contains .reporting', () => {
    const indexPattern = 'xxx.reporting';
    RorMenu.changeTenancy('Infosec', '/app/home#/');
    KibanaNavigation.openKibanaNavigation();
    KibanaNavigation.openPage('Stack Management');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      KibanaNavigation.openSubPage('Data Views');
    } else {
      KibanaNavigation.openSubPage('Index Patterns');
    }
    Discover.createIndexPattern(indexPattern);
    cy.contains('@timestamp').should('be.visible');
    cy.contains('acl_history').should('be.visible');
    cy.contains(indexPattern).should('be.visible');
  });
});
