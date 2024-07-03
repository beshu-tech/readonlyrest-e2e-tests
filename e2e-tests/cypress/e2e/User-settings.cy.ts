import { Login } from '../support/page-objects/Login';
import { UserSettings } from '../support/page-objects/UserSettings';
import { SecuritySettings } from '../support/page-objects/SecuritySettings';

describe('User settings', () => {
  beforeEach(() => {
    Login.initialization();
    UserSettings.open();
  });

  it('should verify user settings change', () => {
    cy.log('Change theme');
    SecuritySettings.getIframeBody().find('[data-test-subj="dark"]').click({ force: true });
    SecuritySettings.getIframeBody().find('button').contains('Reload page').click({ force: true });
    cy.intercept('**/*dark.css').as('darkMode');

    cy.reload();

    cy.wait('@darkMode');
  });
});
