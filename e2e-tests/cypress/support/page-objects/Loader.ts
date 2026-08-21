import { TENANCY_QUERY_STRING_KEY } from '../types';

export class Loader {
  public static loading(finishUrl?: string, spacePrefix?: string) {
    cy.log('loading');
    this.start();
    this.finish(finishUrl, spacePrefix);
  }

  public static waitForBreadcrumb(breadcrumb: string) {
    cy.getByDataTestSubj('breadcrumb first last').contains(breadcrumb);
  }

  private static start() {
    cy.log('loading start');
    cy.contains('Loading Elastic', { timeout: 80000 }).should('exist');
  }

  private static finish(finishUrl = `/app/home?${TENANCY_QUERY_STRING_KEY}=*`, spacePrefix = '/s/default') {
    cy.log('loading finish');
    cy.contains('Loading Elastic', { timeout: 80000 }).should('not.exist');
    cy.location().then(({ pathname, search }) => {
      if (pathname !== '/spaces/space_selector') {
        return;
      }

      const tenancy = new URLSearchParams(search).get(TENANCY_QUERY_STRING_KEY);
      const target = `${spacePrefix}${finishUrl}`.replace(
        `${TENANCY_QUERY_STRING_KEY}=*`,
        `${TENANCY_QUERY_STRING_KEY}=${encodeURIComponent(tenancy ?? '')}`
      );

      // Replace the selector interstitial so browser back still reaches the page before tenancy changed.
      cy.window().then(win => win.location.replace(target));
    });
    cy.urlShouldMatch(`${spacePrefix}${finishUrl}`);
    cy.get('[data-test-subj=globalLoadingIndicator-hidden]').should('be.visible');
  }
}
