import * as semver from 'semver';
import { rorApiInternalKbnClient } from '../support/helpers/RorApiInternalKbnClient';
import { Login } from '../support/page-objects/Login';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { RorMenu } from '../support/page-objects/RorMenu';
import { esApiClient } from '../support/helpers/EsApiClient';
import { getKibanaVersion } from '../support/helpers';
import { Discover } from '../support/page-objects/Discover';
import { Dashboard } from '../support/page-objects/Dashboard';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';

describe('Kibana-config', () => {
  after(() => {
    rorApiInternalKbnClient.changeKibanaConfig('defaultKibanaConfig.yml');
    kbnApiAdvancedClient.waitForKibanaHealth(Cypress.config().baseUrl);
  });

  describe('Custom kibana config', () => {
    before(() => {
      rorApiInternalKbnClient.changeKibanaConfig('customKibanaConfig.yml');
      kbnApiAdvancedClient.waitForKibanaHealth(Cypress.config().baseUrl);
    });
    it('should verify kibanaIndexTemplate functionality', () => {
      const adminCredentials = 'admin:dev';

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
      kbnApiAdvancedClient.deleteSavedObjects(adminCredentials, 'template_group');
      kbnApiAdvancedClient.deleteSavedObjects(adminCredentials);
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
