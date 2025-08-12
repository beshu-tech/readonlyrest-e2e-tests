export class KibanaNavigation {
  static openPage(page: string | RegExp) {
    cy.log('openPage');

    KibanaNavigation.openKibanaNavigation();

    cy.get('[data-test-subj="collapsibleNav"]').find(`[title="${page}"]`).first().click();
  }

  static openSubPage(page: string) {
    cy.log('openPage');
    cy.findByRole('link', {
      name: page
    }).click();
  }

  static openKibanaNavigation() {
    cy.log('openKibanaNavigation');
    // Clear any overlays by pressing ESC prior to opening nav
    cy.get('body').trigger('keydown', { keyCode: 27 });
    cy.wait(200);
    cy.get('body').trigger('keyup', { keyCode: 27 });

    cy.get('[data-test-subj=toggleNavButton]').click({ force: true });
  }

  static checkIfNotVisible(page: string) {
    cy.log('checkIfNotVisible');
    cy.get('[data-test-subj=collapsibleNav]')
      .contains(new RegExp(`^${page}$`))
      .should('not.be.visible');
  }

  static checkIfNotExists(page: string) {
    cy.log('checkIfNotExists');
    cy.get('[data-test-subj=collapsibleNav]')
      .contains(new RegExp(`^${page}$`))
      .should('not.exist');
  }

  static checkIfRouteNotReachable(pathname: string, spacePrefix = '/s/default') {
    cy.log('checkIfRouteNotReachable');
    cy.visit(`${Cypress.config().baseUrl}${pathname}`);
    cy.url().should('include', `${Cypress.config().baseUrl}${spacePrefix}/app/home`);
  }

  static openHomepage() {
    cy.log('Open homepage');
    cy.get('[data-test-subj=logo]').click();
  }
}
