import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { esApiClient } from '../support/helpers/EsApiClient';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { Dashboard } from '../support/page-objects/Dashboard';
import { Discover } from '../support/page-objects/Discover';
import { Login } from '../support/page-objects/Login';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Settings } from '../support/page-objects/Settings';
import { Tenancy } from '../support/page-objects/Tenancy';

describe('Readonlyrest-settings', () => {
  const customSessionIndex = `test_index`;
  const adminCredentials = 'admin:dev';

  afterEach(() => {
    Settings.setReadonlyRestKbnSettings();
    esApiClient.deleteIndex(customSessionIndex);
    kbnApiAdvancedClient.deleteSavedObjects(adminCredentials);
    kbnApiAdvancedClient.deleteSavedObjects(adminCredentials, 'template_group');
  });

  it('should disable multitenancy', () => {
    Settings.setReadonlyRestKbnSettings(`
  multiTenancyEnabled: false
    `);
    Login.initialization({ finishUrl: '/app/home' });
    RorMenu.openRorMenu();
    RorMenu.verifyNoTenantAvailable();
  });

  // The docker env (elk-ror) runs 2 kbn-ror replicas behind kbn-proxy's round robin (see
  // base.docker-compose.yml), so a request of this test can land on either of them, and the two
  // do not share the per-session state that decides whether the tenant index gets reset from the
  // template. That made the test flaky there. The eck-* environments run a single Kibana node
  // (kind-cluster/ror/base/kbn.yml: count: 1), where every request hits the same state.
  (Cypress.env().envName === 'elk-ror' ? it.skip : it)('should verify kibanaIndexTemplate functionality', () => {
    Settings.setReadonlyRestKbnSettings(`
  kibanaIndexTemplate: ".kibana_template_group"
  resetKibanaIndexToTemplate: true
    `);

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

    // A reload is not enough to retrigger the reset: kbn-ror only re-runs the tenant index
    // creation (and with it the reindex from the template) once per session id per index, and
    // remembers that for 2 minutes in the memory of the node that served the request. A login
    // is not subject to that - it always runs the creation for the session it opens - so clear
    // the cookies and sign in again to get a session id the node has not seen yet.
    cy.clearCookies();
    cy.clearLocalStorage();
    Login.initialization();

    Dashboard.openDashboard();
    Dashboard.verifyDashboardNotExist('Look at my dashboard');
  });

  it('should verify index based session', () => {
    Settings.setReadonlyRestKbnSettings(`
  store_sessions_in_index: true
  sessions_index_name: ${customSessionIndex}
    `);

    Login.initialization();
    esApiAdvancedClient.waitForDocsCount(customSessionIndex, 1);
  });

  it('should verify custom Kibana CSS', () => {
    Login.initialization();

    Settings.setReadonlyRestKbnSettings(`
  kibana_custom_css_inject: 'h1 { color: rgb(0,128,0) !important;}'
    `);

    cy.reload();

    cy.get('h1', { timeout: 30000 }).shouldHaveStyle('color', 'rgb(0,128,0)');
  });

  it('should verify custom Kibana JS', () => {
    Login.initialization();

    Settings.setReadonlyRestKbnSettings(`
  kibana_custom_js_inject: "if (window.ROR_METADATA.customMetadata && window.ROR_METADATA.customMetadata.alert_message) {
        const div = document.createElement('div');
        div.setAttribute('data-testid', 'metadata-alert-message');
        div.textContent = window.ROR_METADATA.customMetadata.alert_message;
        document.body.appendChild(div);
      };"
    `);

    cy.reload();

    cy.get('[data-testid="metadata-alert-message"]', { timeout: 30000 })
      .should('exist')
      .then($el => {
        cy.log(`Alert message: ${$el.text()}`);

        cy.wrap($el).should('contain', 'Dear admin');
      });
  });

  it('should verify custom middleware', () => {
    Login.initialization();

    Settings.setReadonlyRestKbnSettings(`
  kibana_custom_js_inject: "if (window.ROR_METADATA.enrichedData) {
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
    `);

    cy.reload();

    cy.get('[data-testid="metadata-enriched-data"]', { timeout: 30000 })
      .should('exist')
      .then($el => {
        cy.log(`Entiched data: ${$el.text()}`);

        cy.wrap($el).should('contain', 'custom enriched data');
      });
  });

  it('should verify whitelisted Urls', () => {
    Settings.setReadonlyRestKbnSettings(`
  whitelistedPaths: [".*/api/status$", ".*/api/index_management/indices$"]
    `);

    cy.request(`${Cypress.config().baseUrl}/api/index_management/indices`).then(response => {
      expect(response.status).to.equal(200);
    });

    cy.request({ url: `${Cypress.config().baseUrl}/api/spaces/space`, failOnStatusCode: false }).then(response => {
      expect(response.status).to.equal(403);
      expect(response.body.error).to.equal('Unauthorized');
    });
  });

  it('should open correct tenancy after login when custom middleware sets defaultGroup', () => {
    Settings.setReadonlyRestKbnSettings(`
  custom_middleware_inject: "async function customMiddleware(req, res, next) {
      const rorRequest = req.rorRequest;
      const userRequest = rorRequest && (await req.rorRequest.getUserRequestIdentity());
      const metadata = userRequest && userRequest.metadata;
      const defaultGroup = 'infosec_group';

      if (rorRequest.getPath() === '/login' && rorRequest.getMethod() === 'post') {
        if (rorRequest.getBody().username === 'admin') {
          rorRequest.setQuery('defaultGroup', defaultGroup);
        }
      }

      if (metadata && rorRequest.getPath() === '/pkp/api/info') {
        const availableGroups = metadata.availableGroups;
        if (availableGroups.some(availableGroup => availableGroup.id === defaultGroup)) {
          const reorderedGroups = [...availableGroups].sort((a, b) =>
            a.id === defaultGroup ? -1 : b.id === defaultGroup ? 1 : 0
          );
          rorRequest.enrichIdentitySessionMetadata({ availableGroups: reorderedGroups });
        }
      }

      return next();
      }"
    `);

    Login.initialization();

    Tenancy.checkTenancyNameInBadge('infosec', 'a');
  });
});
