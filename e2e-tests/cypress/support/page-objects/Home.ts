import * as semver from 'semver';
import { KibanaNavigation } from './KibanaNavigation';
import { getKibanaVersion } from '../helpers';

export class Home {
  static loadSampleData() {
    cy.log('Load sample data');

    cy.intercept('POST', '/s/default/api/sample_data/ecommerce').as('saveSampleData');

    if (semver.lte(getKibanaVersion(), '7.14.0')) {
      cy.findByRole('heading', {
        name: /add data/i
      }).click();

      cy.findByRole('tab', {
        name: /sample data/i
      }).click();
    } else {
      KibanaNavigation.openPage('Home');
      cy.findByText(/try sample data/i).click();

      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        cy.findByText(/other sample data sets/i).click();
      }
    }

    cy.findByRole('button', { name: /add sample ecommerce orders/i }).within(() => {
      cy.findByText(/add data/i).click();
    });

    cy.wait('@saveSampleData');
  }

  static removeSampleData() {
    cy.log('Remove sample data');

    cy.intercept('DELETE', '/s/default/api/sample_data/ecommerce').as('deleteSampleData');

    KibanaNavigation.openPage('Home');
    cy.findByText(/try sample data/i).click();
    cy.findByText(/remove/i).click();

    cy.wait('@deleteSampleData');
  }

  static loadSampleDataButtonHidden() {
    cy.findByRole('button', { name: /add sample ecommerce orders/i }).should('not.exist');
  }
}
