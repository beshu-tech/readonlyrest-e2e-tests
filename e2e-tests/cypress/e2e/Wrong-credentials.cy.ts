import { Login } from '../support/page-objects/Login';
import { Loader } from '../support/page-objects/Loader';

describe('Forbidden login test', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit('/');
  });

  it('should show an error message when using incorrect credentials', () => {
    Login.fillLoginPageWithWrongCredentials();
    
    cy.get('#form-message')
      .should('be.visible')
      .and('contain.text', 'You shall not pass!');
  });

  it('should be able to login after a failed attempt', () => {
    Login.fillLoginPageWithWrongCredentials();
    
    cy.get('#form-message')
      .should('be.visible')
      .and('contain.text', 'You shall not pass!');
    
    cy.get('#form-username').clear();
    cy.get('#form-password').clear();
    Login.fillLoginPage();
    
    Loader.loading();
    
    cy.url().should('include', '/s/default/app/home');
  });
}); 