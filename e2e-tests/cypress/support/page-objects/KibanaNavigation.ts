export class KibanaNavigation {
  static openPage(page: string | RegExp) {
    cy.log('open page');
    KibanaNavigation.openKibanaNavigation();

    cy.get('[data-test-subj="collapsibleNav"]').find(`[title="${page}"]`).first().click();
  }

  static openSubPage(page: string) {
    cy.log('open sub-page');
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

  static checkIfStackManagementSubPageVisible(page: string) {
    cy.log('check if Stack Management sub page visible');
    cy.get('[data-test-subj=mgtSideBarNav]')
      .contains(new RegExp(`^${page}$`))
      .should('be.visible');
  }

  static checkStackManagementSectionElementsCount(
    section: 'ingest' | 'data' | 'insightsAndAlerting' | 'kibana',
    count: number
  ) {
    cy.log('check if Stack Management sub page visible');
    if (count === 0) {
      cy.get('[data-test-subj="mgtSideBarNav"]')
        .find(`[data-test-subj="${section}"]`)
        .should($els => {
          const notExists = $els.length === 0;
          const notVisible = !$els.is(':visible');

          assert.isTrue(notExists || notVisible);
        });
    } else {
      cy.get('[data-test-subj="mgtSideBarNav"]')
        .get(`[data-test-subj=${section}]`)
        .siblings()
        .eq(0)
        .children()
        .should('have.length', count);
    }
  }
}
