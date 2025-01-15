import { Login } from '../support/page-objects/Login';
import { RoAndRoStrictKibanaAccessAssertions } from '../support/page-objects/RoAndRoStrictKibanaAccessAssertions';
import { Settings } from '../support/page-objects/Settings';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { userCredentials } from '../support/helpers';

describe.skip('sanity check ro kibana access', () => {
  beforeEach(() => {
    Login.initialization();
  });

  afterEach(() => {
    Settings.setSettingsData('defaultSettings.yaml');
    kbnApiClient.deleteSampleData('ecommerce', userCredentials, 'template_group');
  });

  it('should verify that everything works', () => {
    RoAndRoStrictKibanaAccessAssertions.runAssertions('roSettings.yaml');
  });
});
