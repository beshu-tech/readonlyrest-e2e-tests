import { Login } from '../support/page-objects/Login';
import { Discover } from '../support/page-objects/Discover';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Reporting } from '../support/page-objects/Reporting';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { kibanaVersion } from '../support/helpers';
import { Loader } from '../support/page-objects/Loader';
import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { SampleData } from '../support/helpers/SampleData';
import { TENANCY_QUERY_STRING_KEY } from '../support/types';
import { Tenancy } from '../support/page-objects/Tenancy';
import { admin } from '../support/helpers/credentials';

describe('sanity check', () => {
  beforeEach(() => {
    // The report assertions below count every row the reporting page lists, so the test needs an
    // empty report store to start from. afterEach alone cannot promise that: when a hook fails, the
    // rest of it is skipped, and the next test then starts with the previous test's report still
    // there and fails with "Too many elements found" instead of the real error.
    //
    // UntilEmpty, not the bare prune: the previous test can leave a report queued but not yet
    // written, and the bare prune would return before it lands.
    esApiAdvancedClient.pruneAllReportingIndicesUntilEmpty();
    SampleData.createSampleData('sample_index');
    Login.initialization();
  });

  afterEach(() => {
    kbnApiAdvancedClient.deleteSampleData('ecommerce', admin);
    kbnApiAdvancedClient.deleteSavedObjects(admin);
    kbnApiAdvancedClient.deleteSavedObjects(admin, 'infosec_group');
    esApiAdvancedClient.pruneAllReportingIndices();
  });

  it('should verify that everything works', () => {
    cy.log('Initialize Administrator tenancy');

    Discover.openDataViewPage();
    Discover.createIndexPattern('s');

    cy.log('Create a CSV report');
    Discover.saveReport('admin_search');
    Discover.exportToCsv();
    // exportToCsv returns once the report is queued, not written - wait for it to be
    // refresh-visible in ES before checking the UI list, which fetches once on load
    // and won't retry a request (see RORDEV-2091).
    if (kibanaVersion.gte('8.15.0')) {
      esApiAdvancedClient.waitForReportingSegmentsDocsCount('.kibana_admins_group', 1);
    }
    Reporting.openReportingPage('kibanaNavigation');
    // On <9.0.0 the report's title can still be "Untitled Discover session" instead of
    // 'admin_search' due to a Kibana title-binding race. The reopen step in
    // Discover.saveReport makes the title reliable on >=9.0.0, so retain title coverage there.
    if (kibanaVersion.gte('9.0.0')) {
      Reporting.verifySavedReport(['admin_search']);
    } else {
      Reporting.verifyReportsCount(1);
    }
    Reporting.downloadAndVerifyAnyReportExists();

    cy.log('Change tenancy, and initialize it');
    // Kibana 8.19 and 9.1+ redirect the reporting page to /exports. 9.0 keeps the bare path.
    const finishUrl = kibanaVersion.has91Features()
      ? '/app/management/insightsAndAlerting/reporting/exports'
      : '/app/management/insightsAndAlerting/reporting';

    RorMenu.changeTenancy('Infosec', finishUrl);

    if (kibanaVersion.gte('8.8.0')) {
      Reporting.noReportsCreatedCheck('rorMenu');
      RorMenu.openDataViewsPage();
      Discover.createIndexPattern('sa');
    } else if (kibanaVersion.gte('8.1.0')) {
      Reporting.noReportsCreatedCheck('rorMenu');
      RorMenu.openDataViewsPage();
      Discover.openDataViewPage();
      Discover.createIndexPattern('sa');
    } else {
      Reporting.noReportsCreatedCheck('rorMenu');
      Discover.openDataViewPage();
      Discover.createIndexPattern('sa');

      cy.log('Create CSV report for the second tenancy');
      Discover.saveReport('infosec_search');
      Discover.exportToCsv();
      Reporting.openReportingPage('rorMenu');
      Reporting.verifyReportsCount(1);
    }

    cy.log('Verify the hidden apps feature');
    KibanaNavigation.openKibanaNavigation();
    KibanaNavigation.checkIfHidden('Stack Management');
    KibanaNavigation.checkIfNotExists('Dev Tools');
    KibanaNavigation.checkIfRouteNotReachable(
      `/s/default/app/management?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedInfosecGroup}`
    );
  });

  it('should check that logout functionality set nextUrl path as expected', () => {
    KibanaNavigation.openPage('Maps');
    RorMenu.openRorMenu();
    RorMenu.pressLogoutButton();
    Login.fillLoginPageWith(admin);

    if (kibanaVersion.gte('8.7.0')) {
      Loader.loading(
        "/app/maps/map?tenancy=*#?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-15m,to:now))&_a=(filters:!(),query:(language:kuery,query:''))"
      );
    } else {
      Loader.loading(
        "/app/maps/map?tenancy=*#?_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-15m,to:now))&_a=(filters:!(),query:(language:kuery,query:''))"
      );
    }

    cy.contains('Elastic Maps Service');
  });
});
