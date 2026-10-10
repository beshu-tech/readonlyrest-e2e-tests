import * as semver from 'semver';
import { recurse } from 'cypress-recurse';
import { KibanaConfig } from '../support/helpers/KibanaConfig';
import { Login } from '../support/page-objects/Login';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { RorMenu } from '../support/page-objects/RorMenu';
import { getKibanaVersion } from '../support/helpers';
import { Discover } from '../support/page-objects/Discover';
import { Dashboard } from '../support/page-objects/Dashboard';
import { Reporting } from '../support/page-objects/Reporting';
import { SampleData } from '../support/helpers/SampleData';
import { esApiClient } from '../support/helpers/EsApiClient';
import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { Tenancy } from '../support/page-objects/Tenancy';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { EnvName } from '../support/types';

const customKibanaIndexName = '.kibana_custom';

// Docker environment only. On ECK the operator renders kibana.yml from the Kibana resource and
// mounts it read-only, so a test cannot replace the file.
(Cypress.env().envName === EnvName.ELK_ROR ? describe : describe.skip)('Kibana-config', () => {
  after(() => {
    KibanaConfig.apply();
    esApiAdvancedClient.deleteIndicesByPattern(customKibanaIndexName);
    esApiAdvancedClient.deleteDataStreamsByPattern(customKibanaIndexName);
  });

  describe('Custom kibana config', () => {
    const adminCredentials = 'admin:dev';
    const customSessionIndex = `test_index`;

    before(() => {
      KibanaConfig.apply('customKibanaConfig.yml');
    });

    afterEach(() => {
      kbnApiAdvancedClient.deleteSavedObjects(adminCredentials, 'template_group');

      // deleteSavedObjects will return 404 error because, thanks to resetKibanaIndexToTemplate: true, ROR KBN plugin will reset all data to template_group deleted above, first
      kbnApiAdvancedClient.getSavedObjects(adminCredentials);

      esApiClient.deleteIndex(customSessionIndex);
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
      Dashboard.openDashboard();
      Dashboard.verifyDashboardExists('ReadonlyREST Audit Dashboard');

      // Verify that the index is reset to the template
      recurse(
        () =>
          cy.kbnImport({
            endpoint: 'api/saved_objects/_import?overwrite=true',
            credentials: adminCredentials,
            fixtureFilename: 'file.ndjson',
            currentGroupHeader: 'admins_group'
          }),
        (response: unknown) => (response as { success?: boolean } | null)?.success === true,
        { limit: 5, delay: 2000, timeout: 30000, log: false }
      );

      // In-app navigation, not a reload. A page load can go to the other Kibana replica, which has not
      // seen this session yet. That replica resets the index to the template and deletes the dashboard.
      KibanaNavigation.openHomepage();
      Dashboard.openDashboard();
      Dashboard.verifyDashboardExists('Look at my dashboard');
      RorMenu.openRorMenu();

      RorMenu.pressLogoutButton();
      // Logging out keeps the current location as nextUrl, so this login lands back on the
      // dashboards list rather than on the home page Loader.loading expects by default.
      Login.initialization({ finishUrl: '/s/default/app/dashboards' });
      Dashboard.openDashboard();
      Dashboard.verifyDashboardNotExist('Look at my dashboard');
    });

    // FIXME: no check that the cleanup task deletes an expired session. The task selects documents
    // on a top-level expiresAt, and the plugin writes a session document without one. Add the check
    // when https://github.com/sscarduzio/readonlyrest_kbn/pull/1088 reaches the dev image.
    it('should verify index based session', () => {
      Login.initialization();
      esApiAdvancedClient.waitForDocsCount(customSessionIndex, 1);
    });

    it('should verify custom Kibana CSS', () => {
      Login.initialization();
      cy.get('h1').shouldHaveStyle('color', 'rgb(0,128,0)');
    });

    it('should verify custom Kibana JS', () => {
      Login.initialization();
      cy.get('[data-testid="metadata-alert-message"]')
        .should('exist')
        .then($el => {
          cy.log(`Alert message: ${$el.text()}`);

          cy.wrap($el).should('contain', 'Dear admin');
        });
    });

    it('should verify custom middleware', () => {
      Login.initialization();
      cy.get('[data-testid="metadata-enriched-data"]')
        .should('exist')
        .then($el => {
          cy.log(`Entiched data: ${$el.text()}`);

          cy.wrap($el).should('contain', 'custom enriched data');
        });
    });

    it('should verify whitelisted Urls', () => {
      cy.request(`${Cypress.config().baseUrl}/api/index_management/indices`).then(response => {
        expect(response.status).to.equal(200);
      });

      // FIXME: expect only 401 when every leg runs a ROR KBN release with readonlyrest_kbn#1074. A
      // request with no session and no credentials gets 401 from builds with #1074 (dev images) and
      // 403 from the releases before it, and a spec cannot tell the two builds apart.
      cy.request({ url: `${Cypress.config().baseUrl}/api/spaces/space`, failOnStatusCode: false }).then(response => {
        expect(response.status).to.be.oneOf([401, 403]);
        expect(response.body.error).to.equal('Unauthorized');
      });
    });
  });

  // FIXME: flaky, about 2 runs in 16 on 8.19.19. When it fails the badge reads 'administrators',
  // the normal first group, so the middleware's reorder of availableGroups on /pkp/api/info did
  // not take — and it then fails all three retries, so it is settled state and not a slow page.
  // It behaves the same with clearSessionOnEvents set and unset, so it is not that. The other
  // eight tests here are steady, so this is skipped rather than left to erode the signal. The skip
  // is on the suite, so its Kibana restart does not run either.
  describe.skip('Default tenant middleware', () => {
    before(() => {
      KibanaConfig.apply('customMiddlewareDefaultTenantKibanaConfig.yml');
    });

    it('should open correct tenancy after login when custom middleware sets defaultGroup', () => {
      Login.initialization();

      Tenancy.checkTenancyNameInBadge('infosec', 'a');
    });
  });

  describe('Custom kibana config multitenancy disabled', () => {
    before(() => {
      KibanaConfig.apply('customKibanaConfigMultitenancyDisabled.yml');
    });

    it('should verify disabled multiTenancy', () => {
      // With multitenancy off there is no tenancy query string, so the default finish URL of
      // Loader.loading ('/s/default/app/home?tenancy=*') never matches.
      Login.initialization({ finishUrl: '/s/default/app/home' });
      RorMenu.openRorMenu();
      RorMenu.verifyNoTenantAvailable();
    });

    it('should verify custom Kibana index', () => {
      const customIndex = `${customKibanaIndexName}_${getKibanaVersion()}_001`;
      esApiClient.findIndicesByPattern(customIndex).then(result => {
        const foundIndex = result.find(({ index }) => index === customIndex);
        if (!foundIndex) throw new Error(`Expected to find an index matching ${customIndex}`);
        expect(foundIndex.index).to.equal(customIndex);
        expect(foundIndex.health).to.equal('green');
        expect(Number.parseInt(foundIndex['docs.count'], 10)).to.be.greaterThan(0);
      });
    });
  });
  // xpack.reporting.index was removed in Kibana 8.0, so this only applies to the 7.x leg.
  if (semver.lt(getKibanaVersion(), '8.0.0')) {
    describe('Custom kibana config custom xpack.reporting.index', () => {
      const docsIndex = 'sample_index';

      before(() => {
        KibanaConfig.apply('customKibanaConfigXpackReportingIndex.yml');
      });

      // The test counts the docs of the sample index and of the reporting index. A retry must not
      // count the docs of the attempt before it, so each attempt starts from an empty store.
      beforeEach(() => {
        esApiClient.deleteIndex(docsIndex);
        esApiAdvancedClient.pruneAllReportingIndicesUntilEmpty();
        kbnApiAdvancedClient.deleteSavedObjects('admin:dev');
      });

      afterEach(() => {
        esApiClient.deleteIndex(docsIndex);
        esApiAdvancedClient.pruneAllReportingIndices();
        kbnApiAdvancedClient.deleteSavedObjects('admin:dev');
      });

      it('should verify custom reporting index', () => {
        SampleData.createSampleData(docsIndex);
        Login.initialization();

        Discover.openDataViewPage();
        Discover.createIndexPattern('sample_index');
        Discover.saveReport('admin_search');
        Discover.exportToCsv();
        Reporting.openReportingPage('kibanaNavigation');
        Reporting.verifySavedReport(['admin_search']);
        esApiAdvancedClient.getAllReportingIndices().then(results => {
          expect(results).to.be.length(1);
          const xpackReportingCustomIndex = results.find(index => index.index.startsWith('.reporting-test-index'));
          if (!xpackReportingCustomIndex) throw new Error('Expected to find a custom reporting index');
          expect(xpackReportingCustomIndex.health).to.equal('green');
          expect(Number.parseInt(xpackReportingCustomIndex['docs.count'], 10)).to.equal(1);
        });
      });
    });
  }
});
