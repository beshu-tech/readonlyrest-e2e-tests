import { Login } from '../support/page-objects/Login';
import { RoAndRoStrictKibanaAccessAssertions } from '../support/page-objects/RoAndRoStrictKibanaAccessAssertions';
import roStrictSettings from '../fixtures/roStrictSettings.json';
import { Settings } from '../support/page-objects/Settings';
import defaultSettings from '../fixtures/defaultSettings.json';

describe.skip('sanity check ro_strict kibana access', () => {
  beforeEach(() => {
    Login.initialization();
  });

  afterEach(() => {
    Settings.setSettingsData(defaultSettings);
    cy.deleteRequest({
      url: `${Cypress.config().baseUrl}/api/sample_data/ecommerce`,
      header: 'x-ror-current-group: template_group'
    });
  });

  it('should verify that everything works', () => {
    RoAndRoStrictKibanaAccessAssertions.runAssertions(roStrictSettings);
  });
});
