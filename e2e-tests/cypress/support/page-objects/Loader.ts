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

  /**
   * Waits for Kibana to finish bootstrapping, without first requiring the "Loading Elastic" splash
   * to be observed the way `loading()` does — after a `cy.reload()` the splash may already be gone
   * by the time the assertion runs, so waiting for its *appearance* is itself a race.
   *
   * Use this to end a test that reloaded the page. A test that finishes while Kibana is still
   * mounting leaves plugin stores mid-initialisation, and Cypress's teardown then fires listeners
   * the half-built app has registered — which surfaces as "Error: executing a cancelled action"
   * attributed to whatever hook happened to be running.
   */
  public static settled() {
    cy.log('loading settled');
    cy.contains('Loading Elastic', { timeout: 80000 }).should('not.exist');
    cy.get('[data-test-subj=globalLoadingIndicator-hidden]', { timeout: 80000 }).should('be.visible');
  }

  private static start() {
    cy.log('loading start');
    cy.contains('Loading Elastic', { timeout: 80000 }).should('exist');
  }

  private static finish(finishUrl = `/app/home?${TENANCY_QUERY_STRING_KEY}=*`, spacePrefix = '/s/default') {
    cy.log('loading finish');
    cy.contains('Loading Elastic', { timeout: 80000 }).should('not.exist');
    cy.urlShouldMatch(`${spacePrefix}${finishUrl}`);
    cy.get('[data-test-subj=globalLoadingIndicator-hidden]').should('be.visible');
  }
}
