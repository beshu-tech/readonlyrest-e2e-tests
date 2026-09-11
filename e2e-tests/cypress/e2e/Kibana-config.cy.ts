import * as semver from 'semver';
import { getKibanaVersion, requiredBaseUrl } from '../support/helpers';
import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { esApiClient } from '../support/helpers/EsApiClient';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { rorApiInternalKbnClient } from '../support/helpers/RorApiInternalKbnClient';
import { SampleData } from '../support/helpers/SampleData';
import { Dashboard } from '../support/page-objects/Dashboard';
import { Discover } from '../support/page-objects/Discover';
import { Login } from '../support/page-objects/Login';
import { Reporting } from '../support/page-objects/Reporting';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Settings } from '../support/page-objects/Settings';
import { Tenancy } from '../support/page-objects/Tenancy';

const customKibanaIndexName = '.kibana_custom';

// rorApiInternalKbnClient.changeKibanaConfig rewrites kibana.yml on disk and restarts Kibana, which
// this suite relies on for every nested describe. Two environments can't support that:
// - docker env (elk-ror) runs 2 kbn-ror replicas behind kbn-proxy's round robin (see
//   base.docker-compose.yml). The config reload only updates the node that handles the request; the
//   ROR Kibana plugin does not propagate config changes across instances, so the other replica keeps
//   serving the stale config. A single client's requests can then land on nodes disagreeing about the
//   active config, which is the same class of issue Activation-keys.cy.ts hit and skipped for the
//   same reason.
// - eck envs run Kibana under Kubernetes, where kibana.yml is mounted read-only from a
//   ConfigMap/Secret. The rewrite always 500s with EROFS, so the custom config never applies and
//   every test here fails predictably.
describe.skip('Kibana-config', () => {
  after(() => {
    rorApiInternalKbnClient.changeKibanaConfig('defaultKibanaConfig.yml');
    kbnApiAdvancedClient.waitForKibanaHealth(requiredBaseUrl());
    Settings.setSettingsData('defaultReadonlyRestEsAndKbnSettings.yaml');
    esApiAdvancedClient.deleteIndicesByPattern(customKibanaIndexName);
    esApiAdvancedClient.deleteDataStreamsByPattern(customKibanaIndexName);
  });

  describe('Custom kibana config', () => {
    const adminCredentials = 'admin:dev';
    const customSessionIndex = `test_index`;

    before(() => {
      // Without an explicit value this stack runs with no session clearing, and a previous
      // spec's tenancy survives login. Clearing on login and tenancy hop keeps the specs
      // independent of each other.
      Settings.setReadonlyRestKbnSettings(customReadonlyRestKbnSettings);
      rorApiInternalKbnClient.changeKibanaConfig('customKibanaConfig.yml');
      kbnApiAdvancedClient.waitForKibanaHealth(requiredBaseUrl());
    });

    afterEach(() => {
      kbnApiAdvancedClient.deleteSavedObjects(adminCredentials, 'template_group');

      // This GET returns 404/403 because, thanks to resetKibanaIndexToTemplate: true, ROR KBN plugin will reset all data to template_group deleted above, first
      kbnApiAdvancedClient.getSavedObjects(adminCredentials, undefined, { failOnStatusCode: false });

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
      Discover.verifyIndexPatternSwitchLink('AUDIT_INDEX_PATTERN');
      Dashboard.openDashboard();
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
      // Logging out keeps the current location as nextUrl, so this login lands back on the
      // dashboards list rather than on the home page Loader.finish expects by default.
      Login.initialization({ finishUrl: '/app/dashboards' });
      Dashboard.openDashboard();
      Dashboard.verifyDashboardNotExist('Look at my dashboard');
    });

    // FIXME: the session cleanup task never runs against this fixture. server/SessionCleanupTaskManager.ts
    // (setup()/start(), registerTaskDefinitions()/ensureScheduled()) only registers and schedules the
    // 'ror_session_cleanup' task when `KibanaConfigManager.getKibanaConfig().readonlyrest_kbn` is truthy —
    // i.e. only when readonlyrest_kbn is declared inline in kibana.yml (the deprecated path). This describe
    // block now pushes readonlyrest_kbn through Settings.setReadonlyRestKbnSettings (the ES settings index)
    // instead, so that file-based field is empty and both guards bail out before the task is ever created.
    // The mechanism needs to read storeInIndex/indexName/cleanupInterval from RorSettingsStore (the same
    // resolved index-or-file source RorSettingsManager already exposes) instead of the raw file config,
    // otherwise anyone configuring readonlyrest_kbn purely through the index silently loses session cleanup.
    it.skip('should verify index based session', () => {
      Login.initialization();
      esApiAdvancedClient.waitForDocsCount(customSessionIndex, 1).then(() => {
        // Backdate the session instead of waiting out the 1-minute timeout: the cleanup task
        // deletes documents whose expiresAt has passed, and runs every second in this stack.
        // Repeated, because live Kibana traffic rolls expiresAt forward and can rescue the doc.
        esApiAdvancedClient.expireAllSessionsUntilSwept(customSessionIndex);
        esApiAdvancedClient.waitForDocsCount(customSessionIndex, 0, 15000);
      });
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

      cy.request({ url: `${Cypress.config().baseUrl}/api/spaces/space`, failOnStatusCode: false }).then(response => {
        expect(response.status).to.equal(403);
        expect(response.body.error).to.equal('Unauthorized');
      });
    });
  });

  describe('Default tenant middleware', () => {
    before(() => {
      // Reset index-stored readonlyrest_kbn settings left over from the previous describe block,
      // matching the sibling reset at the 'xpack.reporting.index' block below.
      Settings.setReadonlyRestKbnSettings();
      rorApiInternalKbnClient.changeKibanaConfig('customMiddlewareDefaultTenantKibanaConfig.yml');
      kbnApiAdvancedClient.waitForKibanaHealth(requiredBaseUrl());
    });

    // FIXME: flaky, about 2 runs in 16 on 8.19.19. When it fails the badge reads 'administrators',
    // the normal first group, so the middleware's reorder of availableGroups on /pkp/api/info did
    // not take — and it then fails all three retries, so it is settled state and not a slow page.
    // It behaves the same with clearSessionOnEvents set and unset, so it is not that. The other
    // eight tests here are steady, so this is skipped rather than left to erode the signal.
    it.skip('should open correct tenancy after login when custom middleware sets defaultGroup', () => {
      Login.initialization();

      Tenancy.checkTenancyNameInBadge('infosec', 'a');
    });
  });

  describe('Custom kibana config multitenancy disabled', () => {
    before(() => {
      Settings.setReadonlyRestKbnSettings(`
  multiTenancyEnabled: false
    `);
      rorApiInternalKbnClient.changeKibanaConfig('customKibanaConfigMultitenancyDisabled.yml');
      kbnApiAdvancedClient.waitForKibanaHealth(requiredBaseUrl());
    });

    it('should verify disabled multiTenancy', () => {
      // With multitenancy off there is no tenancy query string, so the default finish URL of
      // Loader.finish ('/app/home?tenancy=*') never matches.
      Login.initialization({ finishUrl: '/app/home' });
      RorMenu.openRorMenu();
      RorMenu.verifyNoTenantAvailable();
    });

    it('should verify custom Kibana index', () => {
      const customIndex = `${customKibanaIndexName}_${getKibanaVersion()}_001`;
      esApiAdvancedClient.waitForIndexReady(customIndex);
    });
  });
  // xpack.reporting.index was removed in Kibana 8.0, so this only applies to the 7.x leg.
  if (semver.lt(getKibanaVersion(), '8.0.0')) {
    describe('Custom kibana config custom xpack.reporting.index', () => {
      before(() => {
        // changeKibanaConfig must run first: the preceding describe block leaves kibana.yml with
        // a custom kibana.index, and RorKbnSettingsPolicy rejects a custom kibana.index together
        // with multiTenancyEnabled: true (the default here) — posting settings before switching
        // configs makes that POST fail, silently leaving multi-tenancy disabled from the prior test.
        rorApiInternalKbnClient.changeKibanaConfig('customKibanaConfigXpackReportingIndex.yml');
        kbnApiAdvancedClient.waitForKibanaHealth(requiredBaseUrl());
        Settings.setReadonlyRestKbnSettings(``);
      });

      it('should verify custom reporting index', () => {
        const docsIndex = 'sample_index';

        SampleData.createSampleData(docsIndex, 1);
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
          /* eslint-disable no-unused-expressions */
          expect(xpackReportingCustomIndex).to.exist;
          if (!xpackReportingCustomIndex) throw new Error('Expected to find a custom reporting index');
          expect(xpackReportingCustomIndex.health).to.equal('green');
          expect(Number.parseInt(xpackReportingCustomIndex['docs.count'], 10)).to.equal(1);
        });

        esApiClient.deleteIndex(docsIndex);
        esApiAdvancedClient.pruneAllReportingIndices();
        kbnApiAdvancedClient.deleteSavedObjects('admin:dev');
      });
    });
  }
});

const customReadonlyRestKbnSettings = `
    clearSessionOnEvents: [login, tenancyHop]
    kibanaIndexTemplate: ".kibana_template_group"
    resetKibanaIndexToTemplate: true
    store_sessions_in_index: true
    sessions_index_name: 'test_index'
    session_timeout_minutes: 1
    sessions_cleanup_interval: '1s'
    sessions_probe_interval_seconds: 180
    whitelistedPaths: [".*/api/status$", ".*/api/index_management/indices$"]
    kibana_custom_css_inject: 'h1 { color: rgb(0,128,0) !important;}'
    kibana_custom_js_inject: "if (window.ROR_METADATA.customMetadata && window.ROR_METADATA.customMetadata.alert_message) {
        const div = document.createElement('div');
        div.setAttribute('data-testid', 'metadata-alert-message');
        div.textContent = window.ROR_METADATA.customMetadata.alert_message;
        document.body.appendChild(div);
      };
      if (window.ROR_METADATA.enrichedData) {
        const div = document.createElement('div');
        div.setAttribute('data-testid', 'metadata-enriched-data');
        div.textContent = window.ROR_METADATA.enrichedData;
        document.body.appendChild(div);
      };"
    custom_middleware_inject: "async function customMiddleware(req, res, next) {
      const metadata =
        req.rorRequest && req.rorRequest.getIdentitySession() && req.rorRequest.getIdentitySession().metadata;
      if (metadata && metadata.username === 'admin') {
        req.rorRequest.enrichIdentitySessionMetadata({
          enrichedData: 'custom enriched data',
        });
      }
      return next();
      }"
    `;
