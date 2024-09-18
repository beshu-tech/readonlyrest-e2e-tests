import { Login } from '../support/page-objects/Login';
import { RoAndRoStrictKibanaAccessAssertions } from '../support/page-objects/RoAndRoStrictKibanaAccessAssertions';
import roSettings from '../fixtures/roSettings.json';
import { Settings } from '../support/page-objects/Settings';
import defaultSettings from '../fixtures/defaultSettings.json';
import { KbnApiClient } from '../support/helpers/KbnApiClient';
import { userCredentials } from '../support/helpers';

describe('sanity check ro kibana access', () => {
  beforeEach(() => {
    Login.initialization();
  });

  afterEach(() => {
    Settings.setSettingsData(defaultSettings);
    KbnApiClient.instance.deleteSampleData("ecommerce", userCredentials, "template_group");
  });

  it('should verify that everything works', () => {
    RoAndRoStrictKibanaAccessAssertions.runAssertions(roSettings);
  });
});
