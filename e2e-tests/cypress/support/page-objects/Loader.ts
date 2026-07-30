import { recurse } from 'cypress-recurse';
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
   * Waits for Kibana to finish bootstrapping, without requiring the "Loading Elastic" splash to be
   * observed first.
   *
   * Use this to end a test that reloaded the page. A test that finishes while Kibana is still
   * mounting leaves plugin stores half-initialised, and Cypress teardown then fires listeners the
   * half-built app registered, failing whichever hook is running with "executing a cancelled
   * action".
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
   * Gives the "Loading Elastic" splash a bounded chance to appear, but does not fail if it is
   * missed.
   *
   * The splash is transient: on a fast load, or a navigation that does not fully reload the page, it
   * can come and go between Cypress retries or never render at all. Asserting that it exists would
   * fail on a page that is loading correctly.
   *
   * It is still worth waiting for, because it keeps finish() from evaluating against the page we are
   * navigating away from. But only finish()'s URL check really distinguishes the old page from the
   * new one, so the splash is a weak guard and not worth failing on.
   */
  private static start() {
    cy.log('loading start');

    recurse(
      () => cy.get('body', { log: false }),
      $body => $body.text().includes(Loader.SPLASH_TEXT),
      {
        limit: Loader.SPLASH_MAX_POLLS,
        delay: Loader.SPLASH_POLL_MS,
        timeout: Loader.SPLASH_MAX_POLLS * Loader.SPLASH_POLL_MS,
        // Missing the splash is not a failure — see above.
        doNotFail: true,
        yield: 'value',
        log: false
      }
    ).then($body => {
      if (!$body.text().includes(Loader.SPLASH_TEXT)) {
        cy.log('loading start: splash never observed — falling through to the end-state checks');
      }
    });
  }

  private static finish(finishUrl = `/app/home?${TENANCY_QUERY_STRING_KEY}=*`, spacePrefix = '/s/default') {
    cy.log('loading finish');
    cy.contains(Loader.SPLASH_TEXT, { timeout: 80000 }).should('not.exist');
    cy.urlShouldMatch(`${spacePrefix}${finishUrl}`);
    // Explicit 80s rather than the 20s defaultCommandTimeout: start() can fall through before the
    // page has begun rendering, so this assertion carries the wait.
    cy.get('[data-test-subj=globalLoadingIndicator-hidden]', { timeout: 80000 }).should('be.visible');
  }
}
