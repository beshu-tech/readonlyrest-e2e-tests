import { Loader } from './Loader';

export class Login {
  static fillLoginPageWithWrongCredentials() {
    Login.fillLoginPageWith('wrong_username', 'wrong_password');
  }

  static initialization() {
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreKeyExpirationInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
    Login.signIn();
    Loader.loading();
  }

  static signIn() {
    cy.visit(Cypress.config().baseUrl);
    Login.fillLoginPageWith(Cypress.env().login, Cypress.env().password);
  }

  static hasLicenseChangedMessage() {
    cy.log('has license changed message');
    cy.contains(/The licensing edition has been changed./i);
  }

  static fillLoginPageWith(username?: string, password?: string) {
    cy.get('#form-username', { timeout: 30000 }).should('be.visible');

    if (username) {
      cy.get('#form-username').type(username);
    }

    if (password) {
      cy.get('#form-password').type(password);
    }

    cy.get('#form-submit').click({ force: true });
  }
}
