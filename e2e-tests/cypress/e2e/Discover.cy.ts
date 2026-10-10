import semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { Home } from '../support/page-objects/Home';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Discover } from '../support/page-objects/Discover';
import { getKibanaVersion } from '../support/helpers';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { SearchSessions } from '../support/page-objects/SearchSessions';
import { itOnKibana } from '../support/helpers/itOnKibana';
import { admin, user } from '../support/helpers/credentials';

const user4 = user(4);

describe('Discover tests', () => {
  beforeEach(() => {
    if (semver.lt(getKibanaVersion(), '9.0.0')) {
      kbnApiAdvancedClient.deleteSearchSessions(admin);
    }
  });

  afterEach(() => {
    kbnApiClient.deleteSampleData('ecommerce', user4);
  });

  it('should allow to see discover page when user has access only for specific indices', () => {
    Login.initialization({ credentials: user4 });
    Home.loadSampleData();
    KibanaNavigation.openPage('Discover');
    if (semver.lt(getKibanaVersion(), '9.0.0')) {
      Discover.discoverSearchCompleted();
    }
    Discover.verifyDocumentWithTodayRange(0, 'kibana_sample_data_ecommerce');
    Discover.toastErrorNotVisible('Error fetching fields for data view');
  });

  // Kibana 9.0.0 removes the search sessions feature.
  itOnKibana('<9.0.0', 'should allow to save and open discover session', () => {
    Login.initialization();
    Home.loadSampleData();
    KibanaNavigation.openPage('Discover');
    Discover.openSaveSessionPanel();
    Discover.pressSaveSessionButton();
    Discover.pressManageSessionsButton();

    SearchSessions.numberOfVisibleSearchSessions(1);
    SearchSessions.openSelectedSearchSession(0);
    Discover.verifyDiscoverFromSearchSessionCorrectlyRestored();
  });
});
