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

  it('should verify kibanaIndexTemplate functionality', () => {
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

    cy.reload();
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

    cy.get('h1').shouldHaveStyle('color', 'rgb(0,128,0)');
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

    cy.get('[data-testid="metadata-alert-message"]')
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

    cy.get('[data-testid="metadata-enriched-data"]')
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
