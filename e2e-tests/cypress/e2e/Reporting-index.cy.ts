import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Discover } from '../support/page-objects/Discover';
import { Settings } from '../support/page-objects/Settings';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { getKibanaVersion } from '../support/helpers';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';

describe('Reporting index', () => {
  const admin = 'admin:dev';

  beforeEach(() => {
    Settings.setSettingsData('reportingSettings.yaml');
    Login.initialization();
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
    KibanaNavigation.openPage('Stack Management');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      KibanaNavigation.openSubPage('Data Views');
    } else {
      KibanaNavigation.openSubPage('Index Patterns');
    }
    Discover.createIndexPattern(indexPattern);
    cy.contains('@timestamp').should('be.visible');
    cy.contains('acl_history').should('be.visible');
    Discover.verifyIndexTitle(indexPattern);
  });
});
