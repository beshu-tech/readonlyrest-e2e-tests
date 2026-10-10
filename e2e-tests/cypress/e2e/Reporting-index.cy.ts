import { Login } from '../support/page-objects/Login';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Discover } from '../support/page-objects/Discover';
import { Settings } from '../support/page-objects/Settings';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { kibanaVersion } from '../support/helpers';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { TENANCY_QUERY_STRING_KEY } from '../support/types';
import { admin } from '../support/helpers/credentials';

describe('Reporting index', () => {
  beforeEach(() => {
    Settings.setSettingsData('reportingSettings.yaml');
    Login.initialization();
  });

  afterEach(() => {
    kbnApiAdvancedClient.deleteSavedObjects(admin, 'infosec_group');
    if (kibanaVersion.gte('8.0.0')) {
      kbnApiAdvancedClient.deleteDataViews(admin, 'infosec_group');
    }
    Settings.restoreDefaultSettings();
  });

  it('should correctly match index pattern when audit index_template contains .reporting', () => {
    const indexPattern = 'xxx.reporting';
    RorMenu.changeTenancy('Infosec', `/s/default/app/home?${TENANCY_QUERY_STRING_KEY}=*#/`);
    KibanaNavigation.openPage('Stack Management');
    if (kibanaVersion.gte('8.0.0')) {
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
