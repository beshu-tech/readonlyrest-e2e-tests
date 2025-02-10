import { Login } from '../support/page-objects/Login';
import { Loader } from '../support/page-objects/Loader';
import { esApiClient } from '../support/helpers/EsApiClient';
import { Home } from '../support/page-objects/Home';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { userCredentials } from '../support/helpers';
import { Discover } from '../support/page-objects/Discover';
import { Reporting } from '../support/page-objects/Reporting';
import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';

describe('Reporting', () => {
  const oldFormatReportingIndex = '.reporting.kibana_admins_group-2025-02-02';
  const newFormatReportingName = 'new format reporting index doc';
  let oldFormatReportingName: string;

  beforeEach(() => {
    cy.fixture('old_format_reporting_doc.json').then(oldFormatReportingDoc => {
      oldFormatReportingName = oldFormatReportingDoc.payload.title;
      esApiClient.addDocument(
        '.reporting.kibana_admins_group-2025-02-02',
        'ab47a9a1-dcd9-4ccb-89b7-59fb11508894',
        oldFormatReportingDoc
      );
    });

    cy.visit(Cypress.config().baseUrl);
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreTrialInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
    Login.signIn();
    Loader.loading();
  });

  afterEach(() => {
    esApiClient.deleteIndex(oldFormatReportingIndex);
    esApiClient.deleteDataStream('.kibana-reporting-.kibana_admins_group');
    kbnApiClient.deleteSampleData('ecommerce', userCredentials);
    kbnApiAdvancedClient.deleteSavedObjects('admin:dev');
    esApiAdvancedClient.pruneAllReportingIndices();
  });

  it('should correctly match index pattern when audit index_template contains .reporting', () => {
    Home.loadSampleData();
    Discover.openDataViewPage();
    Discover.saveReport(newFormatReportingName);
    Discover.exportToCsv();
    Reporting.openReportingPage('kibanaNavigation');
    Reporting.verifySavedReport([newFormatReportingName, oldFormatReportingName]);
    Reporting.removeReport(newFormatReportingName);
    Reporting.verifySavedReport([oldFormatReportingName]);
    Reporting.removeReport(oldFormatReportingName);
    Reporting.verifySavedReport([]);
  });
});
