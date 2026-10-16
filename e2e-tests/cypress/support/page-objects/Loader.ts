import { recurse } from 'cypress-recurse';
import { TENANCY_QUERY_STRING_KEY } from '../types';

export class Loader {
  // finishUrl is the path of the page that the load ends on, with the space prefix.
  public static loading(finishUrl = `/s/default/app/home?${TENANCY_QUERY_STRING_KEY}=*`) {
    cy.log('loading');
    Loader.start();
    Loader.settled(finishUrl);
  }

  public static waitForBreadcrumb(breadcrumb: string) {
    cy.getByDataTestSubj('breadcrumb first last').contains(breadcrumb);
  }

  /**
   * Waits for Kibana to finish bootstrapping, without requiring the "Loading Elastic" splash to be
   * observed first. With a URL, it also waits for the URL of the page that the load ends on.
   *
   * Use this to end a test that reloaded the page. A test that finishes while Kibana is still
   * mounting leaves plugin stores half-initialised, and Cypress teardown then fires listeners the
   * half-built app registered, failing whichever hook is running with "executing a cancelled
   * action".
   */
  public static settled(url?: string) {
    cy.log('loading settled');
    cy.contains(Loader.SPLASH_TEXT, { timeout: Loader.LOAD_TIMEOUT_MS }).should('not.exist');
    if (url) {
      cy.urlShouldMatch(url);
    }
    // start() can return before the page renders, so this check carries the wait of the load.
    // Chromium 138 does not always see this header svg as visible after a reload, so the check is `exist`.
    cy.get('[data-test-subj=globalLoadingIndicator-hidden]', { timeout: Loader.LOAD_TIMEOUT_MS }).should('exist');
    // Kibana loses the unmount of an app whose mount ends after the page left it. A Home app lost
    // that way keeps its hash router, which rewrites the URL hash of every later page (RORDEV-2315).
    // Home's router writes #/ when it mounts, so a load that ends on Home waits for that.
    if (url?.includes('/app/home')) {
      cy.location('hash', { timeout: Loader.LOAD_TIMEOUT_MS }).should('match', /^#\//);
    }
  }

  // A full Kibana load on a loaded CI runner takes more than the 20 s defaultCommandTimeout.
  private static readonly LOAD_TIMEOUT_MS = 80000;
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
   * It is still worth waiting for, because it keeps settled() from evaluating against the page we are
   * navigating away from. But only the URL check of settled() really distinguishes the old page from the
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
}
