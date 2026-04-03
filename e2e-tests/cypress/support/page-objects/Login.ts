import { Loader } from './Loader';

type Credentials = { username: string; password: string };
export class Login {
  static fillLoginPageWithWrongCredentials() {
    Login.fillLoginPageWith('wrong_username', 'wrong_password');
  }

  static suppressPostLoginNotices() {
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreKeyExpirationInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
  }

  static initialization({
    credentials,
    visitedUrl,
    finishUrl,
    spacePrefix
  }: { credentials?: Credentials; visitedUrl?: string; finishUrl?: string; spacePrefix?: string } = {}) {
    Login.suppressPostLoginNotices();
    Login.signIn({ credentials, visitedUrl });
    Loader.loading(finishUrl, spacePrefix);
  }

  static signIn({
    credentials = {
      username: Cypress.env('login'),
      password: Cypress.env('password')
    },
    visitedUrl = Cypress.config('baseUrl')
  }: {
    credentials?: Credentials;
    visitedUrl?: string;
  } = {}) {
    cy.visit(visitedUrl);
    Login.fillLoginPageWith(credentials.username, credentials.password);
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

  static visitWithSessionCookie(cookieValue: string, url: string) {
    cy.setCookie('rorCookie', cookieValue);
    cy.visit(url);
  }
}
