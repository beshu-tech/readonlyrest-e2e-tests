import { recurse } from 'cypress-recurse';
import { kibanaVersion } from '../helpers';
import { esApiClient } from '../helpers/EsApiClient';

export class Observability {
  // APM Server 8+ writes data streams and creates one at the first flush of each metrics
  // aggregation. Until its primary shard is assigned, a _delete_by_query on it fails with 503
  // "missing shards". A data stream delete reads no shard. APM Server 7 creates its indices at start.
  static deleteApmData() {
    if (kibanaVersion.gte('8.0.0')) {
      esApiClient.deleteDataStream('*-apm*');
    } else {
      esApiClient.deleteIndexDocsByQuery('apm-*');
    }
  }

  static addSampleApmEvents() {
    cy.log('Add sample Apm Events');
    cy.request('http://localhost:3000');
    cy.request({ url: 'http://localhost:3000/error', method: 'GET', failOnStatusCode: false });
  }

  static openApmInstance(name: string) {
    cy.log('Open APM instance');
    Observability.waitForApmApp(name);
    cy.findByText(name).click();
  }

  static changeApmTransactionType(type: 'request' | 'custom') {
    cy.log('change APM transaction type');
    cy.get('[data-test-subj="headerFilterTransactionType"]').select(type);
  }

  static getApmCustomTransaction(name: string) {
    cy.log(`Get apm custom event`);
    Observability.changeApmTransactionType('custom');
    return cy.findByRole('link', {
      name: name
    });
  }

  static getApmError(name: string) {
    cy.log(`Get apm error`);
    Observability.changeApmTransactionType('request');
    Observability.waitForErrorTransaction(name);
    return cy.findByRole('link', {
      name
    });
  }

  // Waits for APM data to travel node-apm-app -> apm-server -> Elasticsearch -> the APM UI. The
  // timeouts are generous because that pipeline is slow on a loaded CI runner, and a poll costs
  // nothing when data arrives early: the loop exits as soon as checkFn passes.
  //
  // A refresh cancels every APM request that is still running, and on a loaded runner a panel
  // request takes up to 2 s. So the loop checks every interval, but refreshes only after
  // REFRESH_EVERY_MS without the data, also at its start: the step before it can have started a
  // request already.
  static waitWithRefreshButtonClick({
    targetSelector,
    checkFn,
    timeout = 60000,
    interval = 1000
  }: {
    targetSelector: string;
    checkFn: (selector: JQuery<HTMLElement>) => boolean;
    timeout?: number;
    interval?: number;
  }): Cypress.Chainable<JQuery<HTMLElement>> {
    const refreshButtonSelector = kibanaVersion.gte('8.0.0')
      ? '[data-test-subj="querySubmitButton"]'
      : '[data-test-subj="superDatePickerApplyTimeButton"]';
    let lastRefreshAt = Date.now();

    return recurse(
      () =>
        cy
          .wrap(null, { log: false })
          .then(() => {
            if (Date.now() - lastRefreshAt >= Observability.REFRESH_EVERY_MS) {
              lastRefreshAt = Date.now();
              cy.get(refreshButtonSelector, { log: false }).click({ force: true, log: false });
            }
          })
          .then(() => cy.wait(interval, { log: false }))
          .then(() => Cypress.$(targetSelector) as JQuery<HTMLElement>),
      checkFn,
      {
        // The interval wait sits inside the polled commands, so `delay` would only add a second one.
        delay: 0,
        limit: Math.ceil(timeout / interval) + 1,
        timeout,
        log: false,
        error: `Timed out after ${timeout}ms waiting for condition on ${targetSelector}`
      }
    );
  }

  private static readonly REFRESH_EVERY_MS = 5000;

  static waitForApmData() {
    return this.waitWithRefreshButtonClick({
      targetSelector: '[data-test-subj="headerFilterTransactionType"]',
      checkFn: $el => {
        const value = $el.val();
        return value === 'request' || value === 'custom';
      },
      // The first APM assertion of the spec, so it also absorbs the initial ingest ramp-up.
      timeout: 120000
    });
  }

  static waitForApmApp(appName: string) {
    return this.waitWithRefreshButtonClick({
      targetSelector: kibanaVersion.gte('8.0.0') ? '[data-test-subj="apmServiceListAppLink"]' : '.euiLink',
      checkFn: $el => {
        const matches = $el.filter((_, el) => el.textContent.includes(appName));
        return matches.length > 0;
      }
    });
  }

  static waitForErrorTransaction(name: string) {
    return this.waitWithRefreshButtonClick({
      targetSelector: kibanaVersion.gte('8.0.0') ? '[data-test-subj="apmErrorDetailsLink"]' : '.euiLink',
      checkFn: $el => {
        const matches = $el.filter((_, el) => el.innerText.includes(name));

        return matches.length > 0;
      }
    });
  }
}
