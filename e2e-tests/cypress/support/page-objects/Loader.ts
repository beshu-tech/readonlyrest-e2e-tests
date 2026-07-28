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

  private static readonly SPLASH_TEXT = 'Loading Elastic';
  private static readonly SPLASH_POLL_MS = 500;
  private static readonly SPLASH_MAX_POLLS = 60; // ~30s

  /**
   * Gives the "Loading Elastic" splash a bounded chance to appear, but does NOT fail if it is
   * missed.
   *
   * The splash is transient. On a fast load — or a navigation that does not trigger a full reload —
   * it can come and go between Cypress's retries, or never render at all. Asserting that it EXISTS
   * then fails after 80s on a page that is loading perfectly well, and
   * "Timed out retrying after 80000ms: Expected to find content: 'Loading Elastic' but never did"
   * has been the single most common failure in this suite. A reachability probe confirmed Kibana was
   * answering in ~20ms throughout one such failure, so the app was fine and only the assertion was
   * wrong.
   *
   * Skipping the wait entirely would be wrong too: it exists so finish() cannot evaluate against the
   * page we are navigating AWAY from. But of finish()'s three checks only the URL match actually
   * discriminates the old page from the new one, so the splash is a weak guard — not worth a hard
   * failure. Waiting for it when it shows, and falling through to the end-state assertions when it
   * does not, keeps the guard's value without its failure mode.
   */
  private static start(pollsLeft: number = Loader.SPLASH_MAX_POLLS) {
    if (pollsLeft === Loader.SPLASH_MAX_POLLS) {
      cy.log('loading start');
    }

    cy.get('body', { log: false }).then($body => {
      if ($body.text().includes(Loader.SPLASH_TEXT)) {
        return;
      }
      if (pollsLeft <= 1) {
        cy.log('loading start: splash never observed — falling through to the end-state checks');
        return;
      }
      cy.wait(Loader.SPLASH_POLL_MS, { log: false });
      Loader.start(pollsLeft - 1);
    });
  }

  private static finish(finishUrl = `/app/home?${TENANCY_QUERY_STRING_KEY}=*`, spacePrefix = '/s/default') {
    cy.log('loading finish');
    cy.contains(Loader.SPLASH_TEXT, { timeout: 80000 }).should('not.exist');
    cy.urlShouldMatch(`${spacePrefix}${finishUrl}`);
    // Explicit 80s rather than the 20s defaultCommandTimeout: start() may now fall through before
    // the page has begun rendering, so this assertion has to carry the patience start() used to.
    cy.get('[data-test-subj=globalLoadingIndicator-hidden]', { timeout: 80000 }).should('be.visible');
  }
}
