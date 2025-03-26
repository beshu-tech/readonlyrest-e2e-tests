import { Login } from '../support/page-objects/Login';
import { Loader } from '../support/page-objects/Loader';

describe('Wrong credentials test', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit('/');
  });

  it('should show an error message when using incorrect credentials', () => {
    Login.fillLoginPageWithWrongCredentials();
    
    cy.get('#form-message')
      .should('be.visible')
      .and('contain.text', 'Wrong credentials');
  });

  it('should be able to login after a failed attempt', () => {
    Login.fillLoginPageWithWrongCredentials();
    
    cy.get('#form-message')
      .should('be.visible');
    
    cy.get('#form-username').clear();
    cy.get('#form-password').clear();
    Login.fillLoginPage();
    
    Loader.loading();
    
    cy.url().should('include', '/s/default/app/home');
  });
}); 