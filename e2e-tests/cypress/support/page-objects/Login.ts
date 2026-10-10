import { Loader } from './Loader';
import { requiredBaseUrl } from '../helpers';
import { sessionEndCompleted } from '../sessionEnd';
import { admin, BasicCredentials } from '../helpers/credentials';

export class Login {
  static fillLoginPageWithWrongCredentials() {
    Login.fillLoginPageWith('wrong_username:wrong_password');
  }

  static suppressPostLoginNotices() {
    cy.setCookie('rorIgnoreActivationKeyInfo', 'true');
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreKeyExpirationInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
  }

  static initialization({
    credentials,
    visitedUrl,
    finishUrl
  }: { credentials?: BasicCredentials; visitedUrl?: string; finishUrl?: string } = {}) {
    Login.suppressPostLoginNotices();
    Login.signIn({ credentials, visitedUrl });
    Loader.loading(finishUrl);
  }

  static signIn({
    credentials = admin,
    visitedUrl = requiredBaseUrl()
  }: {
    credentials?: BasicCredentials;
    visitedUrl?: string;
  } = {}) {
    cy.visit(visitedUrl);
    Login.fillLoginPageWith(credentials);
  }

  static fillLoginPageWith(credentials: BasicCredentials) {
    const [username, password] = credentials.split(':');
    cy.get('#form-username', { timeout: 30000 }).should('be.visible');
    sessionEndCompleted();
    cy.get('#form-username').type(username);
    cy.get('#form-password').type(password, { log: false });

    // The login page disables the button while a login request runs.
    cy.get('#form-submit').should('not.be.disabled').click();
  }

  static verifyLoginPageTitle(title: string) {
    cy.log('Verify login page title');

    cy.contains(title);
  }
}
