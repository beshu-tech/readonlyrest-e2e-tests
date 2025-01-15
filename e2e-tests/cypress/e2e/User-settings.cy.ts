import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { UserSettings } from '../support/page-objects/UserSettings';
import { SecuritySettings } from '../support/page-objects/SecuritySettings';
import { getKibanaVersion } from '../support/helpers';

describe.skip('User settings', () => {
  beforeEach(() => {
    Login.initialization();
    UserSettings.open();
  });

  it('should verify user settings change', () => {
    cy.log('Change theme');
    SecuritySettings.getIframeBody().find('[data-test-subj="dark"]').click({ force: true });
    SecuritySettings.getIframeBody().find('button').contains('Reload page').click({ force: true });
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      cy.intercept('**/*legacy_dark_theme.min.css').as('darkMode');
    } else {
      cy.intercept('**/*dark.css').as('darkMode');
    }

    cy.reload();

    cy.wait('@darkMode');
  });
});
