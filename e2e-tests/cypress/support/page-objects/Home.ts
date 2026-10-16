import { KibanaNavigation } from './KibanaNavigation';
import { kibanaVersion } from '../helpers';
import { expectNotShown } from '../helpers/hiddenByCss';
import { TENANCY_QUERY_STRING_KEY } from '../types';
import { Tenancy } from './Tenancy';

export class Home {
  static loadSampleData() {
    cy.log('Load sample data');

    cy.intercept('POST', '/s/default/api/sample_data/ecommerce').as('saveSampleData');

    if (kibanaVersion.lte('7.14.0')) {
      cy.findByRole('heading', {
        name: /add data/i
      }).click();

      cy.findByRole('tab', {
        name: /sample data/i
      }).click();
    } else {
      KibanaNavigation.openPage('Home');
      cy.findByText(/try sample data/i).click();

      if (kibanaVersion.gte('8.0.0') && kibanaVersion.lt('9.4.0')) {
        cy.findByText(/other sample data sets/i).click();
      }
    }

    if (kibanaVersion.gte('9.4.0')) {
      cy.getByDataTestSubj('addSampleDataSetecommerce').click();
    } else {
      cy.findByRole('button', { name: /add sample ecommerce orders/i }).within(() => {
        // The "other sample data sets" accordion above animates open, so the card can still be
        // moving when this runs and Cypress rejects the click as covered by the euiPageSection
        // wrapper. force skips that check. No `.should('be.visible')` first — that would re-apply
        // the check force is here to skip.
        cy.findByText(/add data/i)
          .scrollIntoView()
          .click({ force: true });
      });
    }

    cy.wait('@saveSampleData');
  }

  static openSampleDataTab() {
    cy.log('Open the sample data tab');
    Tenancy.getTenancyFromUrl().then(tenancy => {
      cy.visit(`/s/default/app/home?${TENANCY_QUERY_STRING_KEY}=${tenancy}#/tutorial_directory/sampleData`);
    });
    // The wait covers the full Kibana load that the visit starts.
    cy.get('[data-test-subj="homeTab-sampleData"]', { timeout: 80000 }).should('exist');
  }

  // The add and remove controls exist only on the sample data tab. The card and its "View data"
  // control prove that the tab is rendered with the installed data set. With the set installed,
  // Kibana renders the remove control, which ROR hides, and no add control.
  static verifySampleDataControlsNotShown() {
    cy.log('Sample data add and remove controls not shown');
    // Kibana 8.x up to 9.3 puts the data set cards in an accordion. A closed EUI accordion keeps its
    // cards in the page (height 0, no display none), so the checks do not open it. Kibana 8.19 can
    // mount the home app again after it shows, so all checks run on one state of the page: separate
    // checks could find the card in one mount and an empty grid in the next.
    cy.get('body').should($body => {
      const exists = (subject: string) => $body.find(`[data-test-subj="${subject}"]`).length > 0;
      expect(exists('sampleDataSetCardecommerce'), 'ecommerce card exists').to.equal(true);
      expect(exists('launchSampleDataSetecommerce'), 'ecommerce launch button exists').to.equal(true);
      expect(exists('removeSampleDataSetecommerce'), 'ecommerce remove button exists').to.equal(true);
      expectNotShown($body, '[data-test-subj="addSampleDataSetecommerce"]');
      expectNotShown($body, '[data-test-subj="removeSampleDataSetecommerce"]');
    });
  }

  static verifyIfCatalogueEmpty() {
    const mainElementSelector = kibanaVersion.gte('8.0.0') ? 'main' : 'div[role="main"]';

    cy.getByDataTestSubj('homeApp')
      .find(mainElementSelector)
      .should('exist')
      .should($main => {
        const directChildrenExpectedCount = kibanaVersion.gte('8.0.0') ? 2 : 1;

        expect($main.children(), 'direct children count').to.have.length(directChildrenExpectedCount);
        expect($main.find('section'), 'no section descendants').to.have.length(0);
      });
  }
}
