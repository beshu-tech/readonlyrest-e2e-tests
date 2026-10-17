import { Login } from '../support/page-objects/Login';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Discover } from '../support/page-objects/Discover';
import { Settings } from '../support/page-objects/Settings';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { kibanaVersion } from '../support/helpers';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { TENANCY_QUERY_STRING_KEY } from '../support/types';
import { adminCredentials } from '../support/helpers/credentials';
import { StackManagement } from '../support/page-objects/StackManagement';

describe('Reporting index', () => {
  beforeEach(() => {
    Settings.setSettingsData('reportingSettings.yaml');
    Login.initialization();
  });

  afterEach(() => {
    kbnApiAdvancedClient.deleteSavedObjects(adminCredentials, 'infosec_group');
    if (kibanaVersion.gte('8.0.0')) {
      kbnApiAdvancedClient.deleteDataViews(adminCredentials, 'infosec_group');
    }
    Settings.restoreDefaultSettings();
  });

  it('should correctly match index pattern when audit index_template contains .reporting', () => {
    const indexPattern = 'xxx.reporting';
    RorMenu.changeTenancy('Infosec', `/s/default/app/home?${TENANCY_QUERY_STRING_KEY}=*#/`);
    KibanaNavigation.openPage('Stack Management');
    if (kibanaVersion.gte('8.0.0')) {
      StackManagement.openPage('Data Views');
    } else {
      StackManagement.openPage('Index Patterns');
    }
    Discover.createIndexPattern(indexPattern);
    cy.contains('@timestamp').should('be.visible');
    cy.contains('acl_history').should('be.visible');
    Discover.verifyIndexTitle(indexPattern);
  });
});
