import { RoAndRoStrictKibanaAccessAssertions } from '../support/page-objects/RoAndRoStrictKibanaAccessAssertions';
import { Settings } from '../support/page-objects/Settings';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { admin } from '../support/helpers/credentials';

describe('sanity check ro_strict kibana access', () => {
  afterEach(() => {
    Settings.restoreDefaultSettings();
    kbnApiClient.deleteSampleData('ecommerce', admin, 'template_group');
  });

  it('should verify that everything works', () => {
    RoAndRoStrictKibanaAccessAssertions.runAssertions('roStrictSettings.yaml', admin);
  });
});
