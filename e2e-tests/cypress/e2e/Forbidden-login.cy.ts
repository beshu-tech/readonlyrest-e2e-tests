import { Login } from '../support/page-objects/Login';
import { Settings } from '../support/page-objects/Settings';
import { admin } from '../support/helpers/credentials';

describe('Forbidden login test', () => {
  before(() => {
    Settings.setSettingsData('defaultSettings.yaml');
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit('/');
  });

  it('should be able to login after a failed attempt with incorrect credentials', () => {
    Login.fillLoginPageWithWrongCredentials();

    cy.get('#form-message').should('be.visible').and('contain.text', 'You shall not pass!');

    Login.initialization({ credentials: admin });

    cy.url().should('include', '/s/default/app/home');
  });
});
