import { Login } from '../support/page-objects/Login';
import { esApiClient } from '../support/helpers/EsApiClient';
import { kibanaVersion } from '../support/helpers';
import { Discover } from '../support/page-objects/Discover';
import { Reporting } from '../support/page-objects/Reporting';
import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { IndexLifecyclesPolicies } from '../support/page-objects/IndexLifecyclesPolicies';
import { SampleData } from '../support/helpers/SampleData';
import { accountOf, admin, kibana } from '../support/helpers/credentials';

const testData = [
  { credentials: kibana, index: '.kibana' },
  { credentials: admin, index: '.kibana_admins_group' }
];

const reportingSampleIndex = 'reporting_sample_index';

if (kibanaVersion.gte('8.15.0')) {
  testData.forEach(({ credentials, index }) => {
    describe(`Reporting tests for ${accountOf(credentials)}`, () => {
      const oldFormatReportingIndex = `.reporting${index}-2025-02-02`;
      const newFormatReportingIndex = `.kibana-reporting-${index}`;
      const newFormatReportingName = 'new format reporting index doc';
      // Kibana 8 can give a report made right after the save the title "Untitled Discover session"
      // (see Reporting.verifyReportsCount), so on 8 either title is the new report.
      const newFormatReportTitle = kibanaVersion.lt('9.0.0')
        ? new RegExp(`${newFormatReportingName}|Untitled Discover session`)
        : newFormatReportingName;
      let oldFormatReportingName: string;

      beforeEach(() => {
        // verifySavedReport counts every listed report, so this suite needs an empty report store
        // plus exactly the one fixture doc it adds below. afterEach cannot promise that on its own:
        // a failed hook skips the rest of the cleanup and the next test then counts the previous
        // test's reports too. Prune first, then add the fixture - the prune also clears
        // `.reporting*` docs, so the two steps must stay in this order.
        esApiAdvancedClient.pruneAllReportingIndicesUntilEmpty();
        // The saved search of a previous test makes the same title ask for a duplicate confirm.
        kbnApiAdvancedClient.deleteSavedObjects(credentials);
        cy.fixture('old_format_reporting_doc.json').then(oldFormatReportingDoc => {
          oldFormatReportingName = oldFormatReportingDoc.payload.title;
          esApiClient.addDocument(oldFormatReportingIndex, oldFormatReportingDoc.id, oldFormatReportingDoc);
          esApiClient.attachLifecyclePolicy(oldFormatReportingIndex, 'kibana-reporting');
        });
      });

      afterEach(() => {
        kbnApiAdvancedClient.deleteSavedObjects(credentials);
        esApiAdvancedClient.pruneAllReportingIndices();
        esApiClient.deleteIndex(oldFormatReportingIndex);
        esApiClient.deleteIndex(reportingSampleIndex);
      });

      it(`should correctly display all reports from both the old reporting index and the new reporting data stream`, () => {
        Login.initialization({ credentials });
        SampleData.createSampleData(reportingSampleIndex);
        Discover.openDataViewPage();
        Discover.createIndexPattern('reporting_sample');
        Discover.saveReport(newFormatReportingName);
        Discover.exportToCsv();
        // The export returns when the report is queued, and the list loads only once.
        esApiAdvancedClient.waitForReportingSegmentsDocsCount(index, 1);
        Reporting.openReportingPage('kibanaNavigation');
        Reporting.verifySavedReport([newFormatReportTitle, oldFormatReportingName]);
        Reporting.removeReport(newFormatReportTitle);
        Reporting.verifySavedReport([oldFormatReportingName]);
        Reporting.removeReport(oldFormatReportingName);
        Reporting.verifySavedReport([]);
        IndexLifecyclesPolicies.openIndexLifecyclePolicy();
        IndexLifecyclesPolicies.verifyIndexLifecyclePolicy();
      });

      it('should display all reports from all reporting data stream segments', () => {
        Login.initialization({ credentials });
        SampleData.createSampleData(reportingSampleIndex);
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
        Reporting.verifySavedReport([newFormatReportTitle, newFormatReportTitle, oldFormatReportingName]);
      });
    });
  });
} else {
  testData.forEach(({ credentials, index }) => {
    const reportingName = `report for ${index} index`;

    describe(`Reporting tests for ${accountOf(credentials)}`, () => {
      // Inside the describe, not beside it. A hook registered outside attaches to the spec's ROOT
      // suite, so testData's two entries give two copies that run before and after EVERY test in
      // the file, including the >=8.15 suite, which does its own pruning.
      //
      // Same reason as the >=8.15 suite above: give every test its own empty report store,
      // because a skipped afterEach otherwise makes the next test fail on the leftovers instead of
      // the real error.
      beforeEach(() => {
        esApiAdvancedClient.pruneAllReportingIndicesUntilEmpty();
        // On Kibana 7, Discover offers "Create index pattern" only when no index pattern exists.
        // Earlier specs can leave one: the APM plugin adds `apm_static_index_pattern_id` to .kibana.
        kbnApiAdvancedClient.deleteSavedObjects(credentials);
      });

      afterEach(() => {
        kbnApiAdvancedClient.deleteSavedObjects(credentials);
        esApiAdvancedClient.pruneAllReportingIndices();
        esApiClient.deleteIndex(reportingSampleIndex);
      });

      it('should correctly display all reporting data', () => {
        Login.initialization({ credentials });
        SampleData.createSampleData(reportingSampleIndex);
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
