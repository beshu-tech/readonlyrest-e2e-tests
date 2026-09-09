import { Login } from '../support/page-objects/Login';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Observability } from '../support/page-objects/Observability';
import { Settings } from '../support/page-objects/Settings';
import { esApiClient } from '../support/helpers/EsApiClient';
import * as semver from 'semver';
import { getKibanaVersion } from '../support/helpers';

describe('Observability', () => {
  beforeEach(() => {
    // The shared default fixture hides the Observability app (hide_apps), so this spec needs
    // its own fixture with that app left visible instead of relying on the shared default.
    Settings.setSettingsData('observabilityVisibleSettings.yaml');
    Login.initialization();
  });

  afterEach(() => {
    esApiClient.deleteIndexDocsByQuery(Observability.APM_DATA_INDEXES_WILDCARD);
    Settings.setSettingsData('defaultReadonlyRestEsAndKbnSettings.yaml');
  });

  it('should verify APM functionality', () => {
    Observability.addSampleApmEvents();
    if (semver.gte(getKibanaVersion(), '8.18.0')) {
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
