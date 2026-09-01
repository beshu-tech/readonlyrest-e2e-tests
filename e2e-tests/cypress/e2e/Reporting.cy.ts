import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { esApiClient } from '../support/helpers/EsApiClient';
import { getKibanaVersion } from '../support/helpers';
import { Discover } from '../support/page-objects/Discover';
import { Reporting } from '../support/page-objects/Reporting';
import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { IndexLifecyclesPolicies } from '../support/page-objects/IndexLifecyclesPolicies';
import { SampleData } from '../support/helpers/SampleData';

const kibanaUser: [string, string] = Cypress.env().kibanaUserCredentials.split(':');
const nonTenantUser = { username: kibanaUser[0], password: kibanaUser[1], index: '.kibana' };
const tenantUser = { username: Cypress.env().login, password: Cypress.env().password, index: '.kibana_admins_group' };

const testData: { username: string; password: string; index: string }[] = [nonTenantUser, tenantUser];

const reportingSampleIndex = 'reporting_sample_index';

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
        esApiClient.deleteIndex(reportingSampleIndex);
      });

      it(`should correctly display all reports from both the old reporting index and the new reporting data stream`, () => {
        Login.initialization({ credentials: { username, password } });
        SampleData.createSampleData(reportingSampleIndex, 1);
        Discover.openDataViewPage();
        Discover.createIndexPattern('reporting_sample');
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
        Login.initialization({ credentials: { username, password } });
        SampleData.createSampleData(reportingSampleIndex, 1);
        Discover.openDataViewPage();
        Discover.createIndexPattern('reporting_sample');
        Discover.saveReport(newFormatReportingName);
        Discover.exportToCsv();
        // Let the first report land before rolling over (see waitForReportingSegmentsDocsCount).
        esApiAdvancedClient.waitForReportingSegmentsDocsCount(index, 1);
        esApiClient.rolloverIndex(newFormatReportingIndex);
        Reporting.verifyAllDataStreamsSegmentsCount(index, 2);
        Discover.exportToCsv();
        // Let the second report land before asserting all three are listed.
        esApiAdvancedClient.waitForReportingSegmentsDocsCount(index, 2);
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
      esApiClient.deleteIndex(reportingSampleIndex);
    });
    describe(`Reporting tests for ${username}`, () => {
      it('should correctly display all reporting data', () => {
        Login.initialization({ credentials: { username, password } });
        SampleData.createSampleData(reportingSampleIndex, 1);
        Discover.openDataViewPage();
        Discover.createIndexPattern('reporting_sample');
        Discover.saveReport(reportingName);
        Discover.exportToCsv();
        Reporting.openReportingPage('kibanaNavigation');
        Reporting.verifySavedReport([reportingName]);
      });
    });
  });
}
