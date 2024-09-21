import { Loader } from './Loader';

export class Login {
  static initialization() {
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreKeyExpirationInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
    cy.visit(Cypress.config().baseUrl, { timeout: 60000 });
    Login.signIn();
    Loader.loading();
  }

  static signIn() {
    cy.visit(Cypress.config().baseUrl, { timeout: 60000 });
    Login.fillLoginPage();
  }

  static fillLoginPage() {
    cy.get('#form-username', { timeout: 60000 }).should('be.visible');
    cy.get('#form-username').type(Cypress.env().login);
    cy.get('#form-password').click({ force: true });
    cy.get('#form-password').type(Cypress.env().password);
    cy.get('#form-submit').click({ force: true });
  }

  static hasLicenseChangedMessage() {
    cy.log('has license changed message');
    cy.contains(/The licensing edition has been changed./i);
  }

  static signOut() {
  cy.visit(`${Cypress.config().baseUrl}/logout`, { timeout: 60000 });
  //   cy.get('[data-test-subj="logo"]').click( {force: true, timeout: 20000} );
  //   cy.wait(10000);
  //   cy.get('#rorMenuPopover', {timeout: 1000}).click()
  //     .then($userMenu => {
  //       if ($userMenu.length > 0) {
  //         cy.contains('button', 'Log out').click({force: true});
  //         cy.log("User Sign out");
  //       } else {
  //         cy.log("User wasn't sign in");
  //       }
  //     });
  }

  static setLogin(user: string) {
    let loginData = user.split(":");
    Cypress.env("login", loginData[0]);
    Cypress.env("password", loginData[1]);
  }
}
