import { PageNotFound } from './PageNotFound';
import { TENANCY_QUERY_STRING_KEY } from '../types';

export class KibanaNavigation {
  // The link must come from the navigation. An unscoped cy.contains() can match a page link with the
  // same text (Home shows "Stack Management" and "Dev Tools" links), and that click leaves the
  // navigation open over the next page.
  static openPage(page: string | RegExp) {
    cy.log('open page');
    KibanaNavigation.openKibanaNavigation();

    cy.get('[data-test-subj="collapsibleNav"]').find(`[title="${page}"]`).first().click();
  }

  // The link must come from the Stack Management navigation. A search in the whole page can also
  // find a landing card, a breadcrumb or a toast with the same text.
  static openSubPage(page: string) {
    cy.log('open sub-page');
    cy.get('[data-test-subj=mgtSideBarNav]').findByRole('link', { name: page }).click();
  }

  static openKibanaNavigation() {
    cy.log('openKibanaNavigation');
    KibanaNavigation.closeOpenOverlays();
    cy.get('[data-test-subj=toggleNavButton]').click({ force: true });
  }

  private static closeOpenOverlays() {
    cy.get('body').trigger('keydown', { keyCode: 27 });
    cy.get('body').trigger('keyup', { keyCode: 27 });
  }

  // ROR hides an app link with injected CSS: display none on the link or on its group. The check
  // looks for that, not for "not visible": Cypress also calls a link "not visible" when it is below
  // the scroll area of the navigation. The visible link first proves that the navigation is open.
  static checkIfHidden(page: string, visiblePage = 'Discover') {
    cy.log('checkIfHidden');
    cy.get('[data-test-subj=collapsibleNav]')
      .contains(new RegExp(`^${visiblePage}$`))
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-test-subj=collapsibleNav]')
      .contains(new RegExp(`^${page}$`))
      .should($link => {
        const hiddenElements = $link
          .parents()
          .addBack()
          .filter((_, el) => Cypress.$(el).css('display') === 'none');
        expect(hiddenElements.length, `${page} link or a parent of it with display: none`).to.be.greaterThan(0);
      });
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
    PageNotFound.visible();
    PageNotFound.goToDefaultRoute();
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

  // ROR copies the tenancy of the page URL into each link. The values are compared decoded, because
  // the page URL and a link can encode the same tenancy in different ways.
  static verifyNavigationLinkHasPageTenancy(appPath: string) {
    cy.log('verifyNavigationLinkHasPageTenancy');
    KibanaNavigation.openKibanaNavigation();

    cy.location('href').then(pageHref => {
      const pageTenancy = new URL(pageHref).searchParams.get(TENANCY_QUERY_STRING_KEY);
      expect(pageTenancy, 'tenancy of the page URL').to.be.a('string').and.have.length.greaterThan(0);

      cy.get('[data-test-subj=collapsibleNav]')
        .find(`a[href*="${appPath}?"]`)
        .first()
        .should($link => {
          const linkTenancy = new URL($link.prop('href')).searchParams.get(TENANCY_QUERY_STRING_KEY);
          expect(linkTenancy, `tenancy of the ${appPath} link`).to.equal(pageTenancy);
        });
    });
  }
}
