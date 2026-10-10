import { Login } from '../support/page-objects/Login';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Observability } from '../support/page-objects/Observability';
import { esApiClient } from '../support/helpers/EsApiClient';
import { kibanaVersion } from '../support/helpers';

describe('Observability', () => {
  beforeEach(() => {
    Login.initialization();
  });

  afterEach(() => {
    esApiClient.deleteIndexDocsByQuery(Observability.APM_DATA_INDEXES_WILDCARD);
  });

  it('should verify APM functionality', () => {
    Observability.addSampleApmEvents();
    if (kibanaVersion.gte('8.18.0')) {
      KibanaNavigation.openPage('Applications');
    } else {
      KibanaNavigation.openPage('APM');
    }
    Observability.openApmInstance('app1');
    Observability.waitForApmData();
    Observability.getApmCustomTransaction('MyCustomTransaction').should('exist').scrollIntoView().should('exist');
    Observability.getApmError('Something went wrong!').should('exist').scrollIntoView().should('exist');
  });
});
