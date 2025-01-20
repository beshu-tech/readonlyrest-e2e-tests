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
    return cy.findByRole('link', {
      name: name
    });
  }

  static waitForApmData(timeout = 100000, interval = 1000) {
    const startTime = Date.now();

    function retry() {
      const elapsedTime = Date.now() - startTime;
      const clickSelector = semver.gte(getKibanaVersion(), '8.0.0')
        ? cy.get('[data-test-subj="querySubmitButton"]')
        : cy.get('[data-test-subj="superDatePickerApplyTimeButton"]');
      const targetSelector = cy.get('[data-test-subj="headerFilterTransactionType"]');

      if (elapsedTime > timeout) {
        throw new Error(`Timed out after ${timeout}ms waiting for ${targetSelector} to become visible`);
      }

      clickSelector.click();
      cy.get('body').then(() => {
        targetSelector.then($el => {
          if ($el.val() !== 'request') {
            // Retry after interval if the element is not visible
            cy.wait(interval).then(retry);
          }
        });
      });
    }

    retry();
  }
}
