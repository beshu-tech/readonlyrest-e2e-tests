import * as semver from 'semver';
import { rorApiInternalKbnClient } from '../support/helpers/RorApiInternalKbnClient';
import { Login } from '../support/page-objects/Login';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { RorMenu } from '../support/page-objects/RorMenu';
import { getKibanaVersion } from '../support/helpers';
import { Discover } from '../support/page-objects/Discover';
import { Dashboard } from '../support/page-objects/Dashboard';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { esApiClient } from '../support/helpers/EsApiClient';

describe('Kibana-config', () => {
  after(() => {
    rorApiInternalKbnClient.changeKibanaConfig('defaultKibanaConfig.yml');
    kbnApiAdvancedClient.waitForKibanaHealth(Cypress.config().baseUrl);
  });

  describe('Custom kibana config', () => {
    const adminCredentials = 'admin:dev';

    before(() => {
      rorApiInternalKbnClient.changeKibanaConfig('customKibanaConfig.yml');
      kbnApiAdvancedClient.waitForKibanaHealth(Cypress.config().baseUrl);
    });

    afterEach(() => {
      kbnApiAdvancedClient.deleteSavedObjects(adminCredentials, 'template_group');

      // deleteSavedObjects will return 404 error because, thanks to resetKibanaIndexToTemplate: true, ROR KBN plugin will reset all data to template_group deleted above, first
      kbnApiAdvancedClient.getSavedObjects(adminCredentials);
    });

    it('should verify kibanaIndexTemplate functionality', () => {
      cy.kbnImport({
        endpoint: 'api/saved_objects/_import?overwrite=true',
        credentials: adminCredentials,
        fixtureFilename: 'audit_dashboard.ndjson',
        currentGroupHeader: 'template_group'
      });

      Login.initialization();
      Discover.openDataViewPage();
      Discover.verifyIndexPatternSwitchLink('readonlyrest_audit-*');
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        KibanaNavigation.openPage('Dashboards');
      } else {
        KibanaNavigation.openPage('Dashboard');
      }
      Dashboard.verifyDashboardExists('ReadonlyREST Audit Dashboard');

      // Verify that the index is reset to the template
      cy.kbnImport({
        endpoint: 'api/saved_objects/_import?overwrite=true',
        credentials: adminCredentials,
        fixtureFilename: 'file.ndjson',
        currentGroupHeader: 'admins_group'
      });

      cy.reload();
      Dashboard.verifyDashboardExists('Look at my dashboard');
      RorMenu.openRorMenu();

      RorMenu.pressLogoutButton();
      Login.initialization();
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        KibanaNavigation.openPage('Dashboards');
      } else {
        KibanaNavigation.openPage('Dashboard');
      }
      Dashboard.verifyDashboardNotExist('Look at my dashboard');
    });
  });

  describe('Custom kibana config multitenancy disabled', () => {
    before(() => {
      rorApiInternalKbnClient.changeKibanaConfig('customKibanaConfigMultitenancyDisabled.yml');
      kbnApiAdvancedClient.waitForKibanaHealth(Cypress.config().baseUrl);
    });

    it('should verify disabled multiTenancy', () => {
      Login.initialization();
      RorMenu.openRorMenu();
      RorMenu.verifyNoTenantAvailable();
    });

    it('should verify custom Kibana index', () => {
      const customIndex = `.kibana_custom_${getKibanaVersion()}_001`;
      esApiClient.findIndicesByPattern(customIndex).then(result => {
        const foundIndex = result.find(({ index }) => index === customIndex);
        expect(foundIndex.index).to.equal(customIndex);
        expect(foundIndex.health).to.equal('green');
        expect(Number.parseInt(foundIndex['docs.count'], 10)).to.be.greaterThan(0);
      });
    });
  });
});
