import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { Loader } from '../support/page-objects/Loader';
import { esApiClient } from '../support/helpers/EsApiClient';
import { Home } from '../support/page-objects/Home';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { getKibanaVersion, userCredentials } from '../support/helpers';
import { Discover } from '../support/page-objects/Discover';
import { Reporting } from '../support/page-objects/Reporting';
import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { IndexLifecyclesPolicies } from '../support/page-objects/IndexLifecyclesPolicies';

if (semver.gte(getKibanaVersion(), '8.15.0')) {
  //FIXME: see https://github.com/beshu-tech/ror-sandbox/pull/74
  describe.skip('Reporting', () => {
    const oldFormatReportingIndex = '.reporting.kibana_admins_group-2025-02-02';
    const newFormatReportingName = 'new format reporting index doc';
    let oldFormatReportingName: string;

    beforeEach(() => {
      cy.fixture('old_format_reporting_doc.json').then(oldFormatReportingDoc => {
        oldFormatReportingName = oldFormatReportingDoc.payload.title;
        esApiClient.addDocument(oldFormatReportingIndex, oldFormatReportingDoc.id, oldFormatReportingDoc);
        esApiClient.attachLifecyclePolicy(oldFormatReportingIndex, 'kibana-reporting');
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

    it('should correctly display all reports for both old reporting index and a new reporting stream data', () => {
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
      IndexLifecyclesPolicies.openIndexLifecyclePolicy();
      IndexLifecyclesPolicies.verifyIndexLifecyclePolicy();
    });
  });
} else {
  describe.skip('Reporting', () => {
    // Tests are skipped
  });
}
