import * as semver from 'semver';
import { getKibanaVersion } from '../helpers';

export class Observability {
  static APM_DATA_INDEXES_WILDCARD = '.ds-*-apm*';

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

  // These polls wait for APM data to travel node-apm-app -> apm-server -> Elasticsearch -> the APM
  // UI, re-clicking refresh each interval. On a loaded CI runner that pipeline regularly overran the
  // old 20s ceiling (7.17 legs failed on `.euiLink` at 20s and on headerFilterTransactionType at
  // 60s). Raising a poll ceiling is close to free: the loop exits the moment the data lands, so a
  // higher limit costs nothing on the happy path and only buys patience on a slow one. It is
  // mitigation rather than a cure — the real fix is gating on the documents existing in ES instead
  // of on the UI rendering them.
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
  }): Cypress.Chainable<void> {
    const start = Date.now();

    const refreshButtonSelector = semver.gte(getKibanaVersion(), '8.0.0')
      ? '[data-test-subj="querySubmitButton"]'
      : '[data-test-subj="superDatePickerApplyTimeButton"]';

    function poll(): Cypress.Chainable<void> {
      const elapsed = Date.now() - start;

      if (elapsed > timeout) {
        throw new Error(`Timed out after ${timeout}ms waiting for condition on ${targetSelector}`);
      }

      return cy
        .get(refreshButtonSelector, { log: false })
        .click({ force: true, log: false })
        .then(() => cy.wait(interval, { log: false }))
        .then(() => {
          const $els = Cypress.$(targetSelector) as JQuery<HTMLElement>;
          const ok = checkFn($els);

          if (ok) {
            return;
          }

          return poll();
        });
    }

    return poll();
  }

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
      targetSelector: semver.gte(getKibanaVersion(), '8.0.0') ? '[data-test-subj="apmServiceListAppLink"]' : '.euiLink',
      checkFn: $el => {
        const matches = $el.filter((i, el) => el.textContent.includes(appName));
        return matches.length > 0;
      }
    });
  }

  static waitForErrorTransaction(name: string) {
    return this.waitWithRefreshButtonClick({
      targetSelector: semver.gte(getKibanaVersion(), '8.0.0') ? '[data-test-subj="apmErrorDetailsLink"]' : '.euiLink',
      checkFn: $el => {
        const matches = $el.filter((i, el) => el.innerText.includes(name));

        return matches.length > 0;
      }
    });
  }
}
