import semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { Home } from '../support/page-objects/Home';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Discover } from '../support/page-objects/Discover';
import { getKibanaVersion } from '../support/helpers';
import { esApiAdvancedClient } from '../support/helpers/EsApiAdvancedClient';
import { SearchSessions } from '../support/page-objects/SearchSessions';

const userCredentials = 'user2:dev';
const tenantIndex = '.kibana_admins_group';
const indexWithSearchSessions = semver.lt(getKibanaVersion(), '8.0.0')
  ? `${tenantIndex}_${getKibanaVersion()}_001`
  : `${tenantIndex}_analytics_${getKibanaVersion()}_001`;

describe('Discover tests', () => {
  afterEach(() => {
    kbnApiClient.deleteSampleData('ecommerce', userCredentials);
    esApiAdvancedClient.deleteIndex(indexWithSearchSessions);
  });

  it('should allow to see discover page when user has access only for specific indices', () => {
    const [username, password] = userCredentials.split(':');
    Login.initialization({ username, password });
    Home.loadSampleData();
    KibanaNavigation.openPage('Discover');
    if (semver.lt(getKibanaVersion(), '9.0.0')) {
      Discover.discoverSearchCompleted();
    }
    Discover.verifyDocumentWithTodayRange(0, 'kibana_sample_data_ecommerce');
    Discover.toastErrorNotVisible('Error fetching fields for data view');
  });

  // Search sessions feature is removed for version 9.0.0 and above
  if (semver.lt(getKibanaVersion(), '9.0.0'))
    it('should allow to save and open discover session', () => {
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
