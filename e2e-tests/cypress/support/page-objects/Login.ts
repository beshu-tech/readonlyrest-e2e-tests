import { Loader } from './Loader';

export class Login {
  static fillLoginPageWithWrongCredentials() {
    Login.fillLoginPageWith('wrong_username', 'wrong_password');
  }

  static initialization(credentials?: { username: string; password: string }) {
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreKeyExpirationInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
    Login.signIn(credentials);
    Loader.loading();
  }

  static signIn(
    { username, password }: { username: string; password: string } = {
      username: Cypress.env().login,
      password: Cypress.env().password
    }
  ) {
    cy.visit(Cypress.config().baseUrl);
    Login.fillLoginPageWith(username, password);
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

  static verifyLoginPageTitle(title: string) {
    cy.log('Verify login page title');

    cy.contains(title);
  }
}
