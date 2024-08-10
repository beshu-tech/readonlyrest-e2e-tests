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
    cy.get('#form-password').click({ force: true });
    cy.get('#form-password').type(Cypress.env().password);
    cy.get('#form-submit').click({ force: true });
  }

  static hasLicenseChangedMessage() {
    cy.log('has license changed message');
    cy.contains(/The licensing edition has been changed./i);
  }
  static signOut() {
    cy.get('[data-test-subj="userMenuButton"]', { timeout: 500 }) // Element wskazujący na zalogowanie
        .then($userMenu => {
          // Sprawdź, czy element istnieje (czyli czy użytkownik jest zalogowany)
          if ($userMenu.length > 0) {
            // Kliknij przycisk wylogowania
            cy.contains('button', 'Log out').click({ force: true });
            cy.log("User Sign out");
          } else {
            cy.log("User wasn't sign in");
          }
        });
  }
}
