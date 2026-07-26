import semver from 'semver';
import { Settings } from '../support/page-objects/Settings';
import { Login } from '../support/page-objects/Login';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Spaces } from '../support/page-objects/Spaces';
import { RorMenu } from '../support/page-objects/RorMenu';
import { getKibanaVersion } from '../support/helpers';
import { PageNotFound } from '../support/page-objects/PageNotFound';
import { SearchApps } from '../support/page-objects/SearchApps';
import { Loader } from '../support/page-objects/Loader';
import { Home } from '../support/page-objects/Home';

describe('hidden apps', () => {
  afterEach(() => {
    Settings.setSettingsData('defaultSettings.yaml');
  });

  context('Stack Management navigation', () => {
    // hiddenSpaceManagementSettings.yaml hides the "Space Management" sub-page 
    // and most other apps, leaving Stack Management with only the Reporting,
    // Data Views (Index Patterns on 7.x), and Saved Objects sub-pages visible.
    it('shows only the allowlisted Stack Management sub-pages when most apps are hidden', () => {
      Settings.setSettingsData('hiddenSpaceManagementSettings.yaml');
      Login.initialization();
      RorMenu.openReportingPage();
      KibanaNavigation.checkStackManagementSectionElementsCount('ingest', 0);
      KibanaNavigation.checkStackManagementSectionElementsCount('data', 0);
      KibanaNavigation.checkStackManagementSectionElementsCount('insightsAndAlerting', 1);
      KibanaNavigation.checkStackManagementSectionElementsCount('kibana', 2);
      KibanaNavigation.checkIfStackManagementSubPageVisible('Reporting');
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        KibanaNavigation.checkIfStackManagementSubPageVisible('Data Views');
      } else {
        KibanaNavigation.checkIfStackManagementSubPageVisible('Index Patterns');
      }
      KibanaNavigation.checkIfStackManagementSubPageVisible('Saved Objects');
    });
  });

  context('default route hidden', () => {
    it('shows "Page not found" on login when navigation to the default route is prohibited', () => {
      Settings.setSettingsData('hiddenHomePageSettings.yaml');
      Login.initialization({ finishUrl: '/app/page-not-found', spacePrefix: '' });
      PageNotFound.visible();
    });
  });

  context('Space solution view selector', () => {
    // Security is always pre-populated in APP_IDS_TO_BE_HIDDEN regardless of config; no explicit settings call needed
    it('does not show the Security option in the solution view dropdown when creating a space', () => {
      if (semver.lt(getKibanaVersion(), '8.18.0')) {
        cy.log('Solution view selector not available before Kibana 8.18.0 — skipping');
        return;
      }

      Login.initialization();
      Spaces.navigateToCreateSpacePage();
      Spaces.openSolutionViewDropdown();

      Spaces.verifySolutionViewSecurityOptionIsHidden();
      Spaces.verifySolutionViewOptionsAreVisible(
        'solutionViewEsOption',
        'solutionViewObltOption',
        'solutionViewClassicOption'
      );
    });
  });

  context('Kibana global search', () => {
    beforeEach(() => {
      Settings.setSettingsData('hiddenAllAppsSettings.yaml');
      Login.initialization();
    });

    it('returns only Stack Management when all apps are hidden, and no results for hidden-app queries', () => {
      Loader.waitForBreadcrumb('Home');
      SearchApps.openSearchAppsDropdown();
      // Only Stack Management should be visible because if we hide all apps,
      // there is only a loading indicator visible in the Kibana UI.
      SearchApps.verifyAppsInSearchResults(['Stack Management']);
      Home.verifyIfCatalogueEmpty();

      SearchApps.searchApp('aws');
      SearchApps.noResultsFound();

      SearchApps.searchApp('type:integration');
      SearchApps.noResultsFound();

      SearchApps.searchApp('readonly');
      SearchApps.noResultsFound();

      SearchApps.searchApp('Index');
      SearchApps.noResultsFound();
    });
  });
});
