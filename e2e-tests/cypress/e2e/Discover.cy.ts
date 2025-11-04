import { Login } from '../support/page-objects/Login';
import { Loader } from '../support/page-objects/Loader';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { Home } from '../support/page-objects/Home';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Discover } from '../support/page-objects/Discover';
import semver from 'semver/preload';
import { getKibanaVersion } from '../support/helpers';

const userCredentials = 'user4:dev';

describe('Discover tests', () => {
  afterEach(() => {
    kbnApiClient.deleteSampleData('ecommerce', userCredentials);
  });

  it('should allow to see discover page when user has access only for specific indices', () => {
    cy.visit(Cypress.config().baseUrl);
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreTrialInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });

    const [username, password] = userCredentials.split(':');

    Login.fillLoginPageWith(username, password);
    Loader.loading();
    Home.loadSampleData();
    KibanaNavigation.openPage('Discover');
    if (semver.lt(getKibanaVersion(), '9.0.0')) {
      Discover.discoverSearchCompleted();
    }
    Discover.verifyDocumentWithTodayRange(0, 'kibana_sample_data_ecommerce');
    Discover.toastErrorNotVisible('Error fetching fields for data view');
  });
});
