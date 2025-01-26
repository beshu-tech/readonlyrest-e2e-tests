import { Login } from '../support/page-objects/Login';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Observability } from '../support/page-objects/Observability';
import { esApiClient } from '../support/helpers/EsApiClient';

describe('Observability', () => {
  beforeEach(() => {
    Login.initialization();
  });

  afterEach(() => {
    esApiClient.deleteIndexDocsByQuery(Observability.APM_DATA_INDEXES_WILDCARD);
  });

  it('should verify APM functionality', () => {
    Observability.addSampleApmEvents();
    KibanaNavigation.openPage('APM');
    Observability.openApmInstance('app1');
    Observability.waitForApmData();
    Observability.getApmCustomTransaction('MyCustomTransaction').should('be.visible');
    Observability.getApmError('Something went wrong!').should('be.visible');
  });
});
