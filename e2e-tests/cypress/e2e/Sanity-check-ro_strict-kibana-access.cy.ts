import { Login } from '../support/page-objects/Login';
import { RoAndRoStrictKibanaAccessAssertions } from '../support/page-objects/RoAndRoStrictKibanaAccessAssertions';
import roStrictSettings from '../fixtures/roStrictSettings.json';
import { Settings } from '../support/page-objects/Settings';
import defaultSettings from '../fixtures/defaultSettings.json';
import { kbnApiClient, KbnApiClient } from '../support/helpers/KbnApiClient';
import { userCredentials } from '../support/helpers';

describe('sanity check ro_strict kibana access', () => {
  beforeEach(() => {
    Login.initialization();
  });

  afterEach(() => {
    Settings.setSettingsData(defaultSettings);
    kbnApiClient.deleteSampleData("ecommerce", userCredentials, "template_group");
  });

  it('should verify that everything works', () => {
    RoAndRoStrictKibanaAccessAssertions.runAssertions(roStrictSettings);
  });
});
