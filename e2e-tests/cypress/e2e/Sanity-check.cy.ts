import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { Discover } from '../support/page-objects/Discover';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Reporting } from '../support/page-objects/Reporting';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { getKibanaVersion } from '../support/helpers';
import { Loader } from '../support/page-objects/Loader';
import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { SampleData } from '../support/helpers/SampleData';

describe('sanity check', () => {
  beforeEach(() => {
    SampleData.createSampleData("sample_index", 1)
    Login.initialization();
  });

  afterEach(() => {
    esApiAdvancedClient.deleteIndex("sample_index");
    kbnApiAdvancedClient.deleteSavedObjects("admin:dev");
    kbnApiAdvancedClient.deleteSavedObjects("admin:dev", "infosec_group")
    esApiAdvancedClient.pruneAllReportingIndices();
  });

  it('should verify that everything works', () => {
    cy.log('Initialize Administrator tenancy');

    Discover.openDataViewPage();
    Discover.createIndexPattern('s');

    cy.log('Create a CSV report');
    Discover.saveReport('admin_search');
    Discover.exportToCsv();
    Reporting.verifySavedReport('admin_search', 'kibanaNavigation', 1);

    cy.log('Change tenancy, and initialize it');
    RorMenu.changeTenancy('Infosec', '/app/management/insightsAndAlerting/reporting');

    if (semver.gte(getKibanaVersion(), '8.8.0')) {
      Reporting.noReportsCreatedCheck('rorMenu');
      RorMenu.openDataViewsPage();
      Discover.createIndexPattern('sa');
    } else if (semver.gte(getKibanaVersion(), '8.1.0')) {
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
      Reporting.verifySavedReport('infosec_search', 'rorMenu', 1);
    }

    cy.log('Verify the hidden apps feature');
    KibanaNavigation.openKibanaNavigation();
    KibanaNavigation.checkIfNotVisible('Stack Management');
    KibanaNavigation.checkIfNotExists('Dev Tools');
    KibanaNavigation.checkIfRouteNotReachable('/s/default/app/management');
  });

  it('should check that logout functionality set nextUrl path as expected', () => {
    KibanaNavigation.openPage('Maps');
    RorMenu.openRorMenu();
    RorMenu.pressLogoutButton();
    Login.fillLoginPage();

    if (semver.gte(getKibanaVersion(), '8.7.0')) {
      Loader.loading(
        "/app/maps/map#?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-15m,to:now))&_a=(filters:!(),query:(language:kuery,query:''))"
      );
    } else {
      Loader.loading(
        "/app/maps/map#?_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-15m,to:now))&_a=(filters:!(),query:(language:kuery,query:''))"
      );
    }

    cy.contains('Elastic Maps Service');
  });
});
