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

  static waitWithRefreshButtonClick({
    targetSelector,
    checkFn,
    timeout = 20000,
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
      }
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
