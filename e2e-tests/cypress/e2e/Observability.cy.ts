import { Login } from '../support/page-objects/Login';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Observability } from '../support/page-objects/Observability';

describe('Observability', () => {
  beforeEach(() => {
    Login.initialization();
  });

  it('should verify APM functionality', () => {
    Observability.addSampleApmEvents();
    KibanaNavigation.openPage('APM');
    Observability.openApmInstance('app1');
    Observability.changeApmTransactionType('custom');
    Observability.getApmCustomEvent('MyCustomTransaction').should('be.visible');
    Observability.getApmCustomEvent('Something went wrong!').should('be.visible');
  });
});
