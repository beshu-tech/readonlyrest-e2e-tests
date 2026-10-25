import { PageNotFound } from './PageNotFound';
import { TENANCY_QUERY_STRING_KEY } from '../types';
import { isHiddenByCss } from '../helpers/hiddenByCss';

export class KibanaNavigation {
  // The link must come from the navigation. An unscoped cy.contains() can match a page link with the
  // same text (Home shows "Stack Management" and "Dev Tools" links), and that click leaves the
  // navigation open over the next page.
  static openPage(page: string) {
    cy.log('open page');
    KibanaNavigation.openKibanaNavigation();

    cy.get('[data-test-subj="collapsibleNav"]').find(`[title="${page}"]`).first().click();
  }

  // The button toggles: a click on an open nav closes it. So it clicks only when aria-expanded says
  // the nav is closed. Kibana 7.17 to 9.5 sets that attribute on the button.
  static openKibanaNavigation() {
    cy.log('openKibanaNavigation');
    KibanaNavigation.closeOpenOverlays();
    cy.get('[data-test-subj=toggleNavButton]').then($button => {
      if ($button.attr('aria-expanded') !== 'true') {
        cy.wrap($button).click();
      }
    });
    cy.get('[data-test-subj=toggleNavButton]').should('have.attr', 'aria-expanded', 'true');
    cy.get('[data-test-subj=collapsibleNav]').should('be.visible');
  }

  private static closeOpenOverlays() {
    cy.get('body').trigger('keydown', { keyCode: 27 });
    cy.get('body').trigger('keyup', { keyCode: 27 });
  }

  // ROR hides an app link with CSS on the link or on its group. The visible link first proves that
  // the navigation is open.
  static verifyAppLinkNotShown(app: string, visibleApp = 'Discover') {
    cy.log(`verify the ${app} link is not shown`);
    cy.get('[data-test-subj=collapsibleNav]')
      .contains(new RegExp(`^${visibleApp}$`))
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-test-subj=collapsibleNav]')
      .contains(new RegExp(`^${app}$`))
      .should($link => {
        expect(isHiddenByCss($link), `${app} link or a parent of it with display: none`).to.equal(true);
      });
  }

  // From Kibana 8.0, the title of a category can be the link of an app, for example Management. ROR keeps
  // the title of a hidden app and turns off its pointer events. A user's click at the title then lands
  // on the element under it, which opens or closes the category.
  static verifyCategoryTitleLinkBlocked(appPath: string) {
    cy.log(`verify the category title link to ${appPath} does not open the app`);
    cy.location('href').then(pageHref => {
      cy.get('[data-test-subj=collapsibleNav]')
        .find(`[data-test-subj="collapsibleNavAppLink-overview"][href*="${appPath}"]`)
        // The navigation is fixed and scrolls by itself, so the title can be under its fold.
        .scrollIntoView()
        .should('be.visible')
        .and('have.css', 'pointer-events', 'none')
        .then($title => {
          const { left, top, width, height } = $title[0].getBoundingClientRect();
          const elementUnderClick = $title[0].ownerDocument.elementFromPoint(left + width / 2, top + height / 2);
          expect(elementUnderClick, 'element under the title').to.not.equal(null);
          expect($title[0].contains(elementUnderClick), 'the click lands on the title link').to.equal(false);
          cy.wrap(elementUnderClick).click();
        });
      cy.location('href').should('equal', pageHref);
    });
  }

  static verifyAppLinkAbsent(app: string) {
    cy.log(`verify the ${app} link is absent`);
    cy.get('[data-test-subj=collapsibleNav]')
      .contains(new RegExp(`^${app}$`))
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
        .find(`[data-test-subj=${section}]`)
        .siblings()
        .eq(0)
        .children()
        .should('have.length', count);
    }
  }

  // Counts the links in all sections, so a section that the per-section checks do not name cannot add
  // links. A link that ROR hides with CSS does not count.
  static verifyStackManagementShownLinksCount(count: number) {
    cy.log('check the count of shown Stack Management links');
    cy.get('[data-test-subj="mgtSideBarNav"]')
      .find('.euiSideNavItem a')
      .should($links => {
        const shownLinks = $links.filter((_, link) => !isHiddenByCss(Cypress.$(link)));
        expect(shownLinks.length, 'shown Stack Management links').to.equal(count);
      });
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
