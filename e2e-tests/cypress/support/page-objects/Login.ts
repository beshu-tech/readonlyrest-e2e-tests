import { Loader } from './Loader';

export class Login {
  static initialization() {
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreKeyExpirationInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
    cy.visit(Cypress.config().baseUrl);
    Login.signIn();
    Loader.loading();
  }

  static signIn() {
    cy.visit(Cypress.config().baseUrl);
    Login.fillLoginPage();
  }

  static fillLoginPage() {
    cy.get('#form-username', { timeout: 30000 }).should('be.visible');
    cy.get('#form-username').type(Cypress.env().login);
    cy.get('#form-password').type(Cypress.env().password);
    cy.get('#form-submit').click({ force: true });
  }

  static hasLicenseChangedMessage() {
    cy.log('has license changed message');
    cy.contains(/The licensing edition has been changed./i);
  }
}
