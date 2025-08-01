import { Login } from '../support/page-objects/Login';
import { Loader } from '../support/page-objects/Loader';
import { Settings } from '../support/page-objects/Settings';

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

    cy.get('#form-username').clear();
    cy.get('#form-password').clear();
    Login.fillLoginPageWith(Cypress.env().login, Cypress.env().password);

    Loader.loading();

    cy.url().should('include', '/s/default/app/home');
  });
});
