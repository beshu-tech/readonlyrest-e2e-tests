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

      if (semver.gte(getKibanaVersion(), '8.0.0') && semver.lt(getKibanaVersion(), '9.4.0')) {
        cy.findByText(/other sample data sets/i).click();
      }
    }

    if (semver.gte(getKibanaVersion(), '9.4.0')) {
      cy.getByDataTestSubj('addSampleDataSetecommerce').click();
    } else {
      cy.findByRole('button', { name: /add sample ecommerce orders/i }).within(() => {
        // The "other sample data sets" accordion above animates its height open, so the card can
        // still be mid-flight when this runs and Cypress rejects the click as "covered by another
        // element" (the euiPageSection wrapper). force skips the covered-element check, the same
        // escape hatch KibanaNavigation already uses for the nav toggle.
        //
        // Deliberately no `.should('be.visible')`: force exists to skip exactly that check, so
        // asserting it first re-introduces the failure this is meant to avoid. Asserting visibility
        // on an element that is about to be force-clicked is what broke every 9.x leg in RorMenu.
        cy.findByText(/add data/i)
          .scrollIntoView()
          .click({ force: true });
      });
    }

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

  static verifyIfCatalogueEmpty() {
    const mainElementSelector = semver.gte(getKibanaVersion(), '8.0.0') ? 'main' : 'div[role="main"]';

    cy.getByDataTestSubj('homeApp')
      .find(mainElementSelector)
      .should('exist')
      .should($main => {
        const directChildrenExpectedCount = semver.gte(getKibanaVersion(), '8.0.0') ? 2 : 1;

        expect($main.children(), 'direct children count').to.have.length(directChildrenExpectedCount);
        expect($main.find('section'), 'no section descendants').to.have.length(0);
      });
  }
}
