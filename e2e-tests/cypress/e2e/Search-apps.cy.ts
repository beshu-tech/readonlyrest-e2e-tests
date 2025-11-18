import { Settings } from '../support/page-objects/Settings';
import { Login } from '../support/page-objects/Login';
import { SearchApps } from '../support/page-objects/SearchApps';
import { Loader } from '../support/page-objects/Loader';
import { Home } from '../support/page-objects/Home';

describe('Search apps', () => {
  beforeEach(() => {
    Settings.setSettingsData('hiddenAllAppsSettings.yaml');
    Login.initialization();
  });

  afterEach(() => {
    Settings.setSettingsData('defaultSettings.yaml');
  });

  it('should hide all apps except of Stack Management', () => {
    Loader.waitForBreadcrumb('Home');
    SearchApps.openSearchAppsDropdown();
    SearchApps.verifyAppsInSearchResults(['Stack Management']); // only Stack Management app should be visible, because if we hide all apps, there is only loading indicator visible in a Kibana UI
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
