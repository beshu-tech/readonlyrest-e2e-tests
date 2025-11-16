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

  static waitWithRefreshButtonClick({ targetSelector, checkFn, timeout = 100000, interval = 1000 }) {
    const start = Date.now();

    const refreshButtonSelector = semver.gte(getKibanaVersion(), '8.0.0')
      ? '[data-test-subj="querySubmitButton"]'
      : '[data-test-subj="superDatePickerApplyTimeButton"]';

    function retry() {
      const elapsed = Date.now() - start;

      if (elapsed > timeout) {
        throw new Error(`Timed out after ${timeout}ms waiting for condition on ${targetSelector}`);
      }

      cy.get(refreshButtonSelector).click();

      cy.then(() => {
        const ok = checkFn(Cypress.$(targetSelector));
        if (!ok) {
          cy.wait(interval).then(retry);
        }
      });
    }

    retry();
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
      targetSelector: '[data-test-subj="apmServiceListAppLink"]',
      checkFn: $el => {
        return $el.filter((i, el) => el.textContent.includes(appName)).length > 0;
      }
    });
  }

  static waitForErrorTransaction(name: string) {
    return this.waitWithRefreshButtonClick({
      targetSelector: '[data-test-subj="apmErrorDetailsLink"]',
      checkFn: $el => {
        const matches = $el.filter((i, el) => el.innerText.includes(name));

        return matches.length > 0;
      }
    });
  }
}
