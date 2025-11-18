import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { esApiClient } from '../support/helpers/EsApiClient';
import { Home } from '../support/page-objects/Home';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { getKibanaVersion, userCredentials } from '../support/helpers';
import { Discover } from '../support/page-objects/Discover';
import { Reporting } from '../support/page-objects/Reporting';
import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { IndexLifecyclesPolicies } from '../support/page-objects/IndexLifecyclesPolicies';

const kibanaUser: [string, string] = Cypress.env().kibanaUserCredentials.split(':');
const nonTenantUser = { username: kibanaUser[0], password: kibanaUser[1], index: '.kibana' };
const tenantUser = { username: Cypress.env().login, password: Cypress.env().password, index: '.kibana_admins_group' };

const testData: { username: string; password: string; index: string }[] = [nonTenantUser, tenantUser];

if (semver.gte(getKibanaVersion(), '8.15.0')) {
  testData.forEach(({ username, password, index }) => {
    describe(`Reporting tests for ${username}`, () => {
      const oldFormatReportingIndex = `.reporting${index}-2025-02-02`;
      const newFormatReportingIndex = `.kibana-reporting-${index}`;
      const newFormatReportingName = 'new format reporting index doc';
      let oldFormatReportingName: string;

      beforeEach(() => {
        cy.fixture('old_format_reporting_doc.json').then(oldFormatReportingDoc => {
          oldFormatReportingName = oldFormatReportingDoc.payload.title;
          esApiClient.addDocument(oldFormatReportingIndex, oldFormatReportingDoc.id, oldFormatReportingDoc);
          esApiClient.attachLifecyclePolicy(oldFormatReportingIndex, 'kibana-reporting');
        });
      });

      afterEach(() => {
        kbnApiAdvancedClient.deleteSavedObjects(`${username}:${password}`);
        esApiAdvancedClient.pruneAllReportingIndices();
        esApiClient.deleteIndex(oldFormatReportingIndex);
        kbnApiClient.deleteSampleData('ecommerce', `${username}:${password}`);
      });

      it(`should correctly display all reports from both the old reporting index and the new reporting data stream`, () => {
        Login.initialization({ username, password });
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

      it('should display all reports from all reporting data stream segments', () => {
        Login.initialization({ username, password });
        Home.loadSampleData();
        Discover.openDataViewPage();
        Discover.saveReport(newFormatReportingName);
        Discover.exportToCsv();
        esApiClient.rolloverIndex(newFormatReportingIndex);
        Reporting.verifyAllDataStreamsSegmentsCount(index, 2);
        Discover.exportToCsv();
        Reporting.openReportingPage('kibanaNavigation');
        Reporting.verifySavedReport([newFormatReportingName, newFormatReportingName, oldFormatReportingName]);
      });
    });
  });
} else {
  testData.forEach(({ username, password, index }) => {
    const reportingName = `report for ${index} index`;

    afterEach(() => {
      kbnApiAdvancedClient.deleteSavedObjects(`${username}:${password}`);
      esApiAdvancedClient.pruneAllReportingIndices();
      kbnApiClient.deleteSampleData('ecommerce', `${username}:${password}`);
    });
    describe(`Reporting tests for ${username}`, () => {
      it('should correctly display all reporting data', () => {
        Login.initialization({ username, password });
        Home.loadSampleData();
        Discover.openDataViewPage();
        Discover.saveReport(reportingName);
        Discover.exportToCsv();
        Reporting.openReportingPage('kibanaNavigation');
        Reporting.verifySavedReport([reportingName]);
      });
    });
  });
}
