import { KibanaNavigation } from '../KibanaNavigation';

export class Reports {
  static navigateTo() {
    cy.log('navigateTo');

    // Check if we are already on the Stack Management page
    cy.url().then(url => {
      if (!url.includes('/app/management')) {
        // If not, open Kibana navigation and click on Stack Management
        KibanaNavigation.openKibanaNavigation();
        cy.contains('Stack Management').click();
      }

      // Now, click on Reporting (whether we were already on Stack Management or not)
      cy.contains('Reporting').click({timeout: 10000});
    });
  }

  static checkAllReports(reportTitle: string = 'Untitled discover search') {
    cy.log('waitForAllReportsToBeDone');

    cy.get('tr[data-test-subj="reportJobRow"]')
      .then($reportItems => {
        // Convert the jQuery object to an array and reverse it
        const reversedReportItems = Cypress.$($reportItems.get().reverse());

        // Iterate over the reversed array
        cy.wrap(reversedReportItems).each($reportItem => {
          cy.wrap($reportItem)
            .find('[data-test-subj="reportingListItemObjectTitle"]')
            .should('contain.text', reportTitle);

          cy.wrap($reportItem)
            .find('[data-test-subj="reportJobStatus"]')
            .contains(/Done|Completed/, {timeout: 60000})
            .should('be.visible').then($status => {
          });
        });
      })
      .then($matchingReports => {
        expect($matchingReports).to.have.length(10);
      });
  }

  static verifyNoReports() {
    cy.log('verifyNoReports');

    // Assert that there are no report rows present
    cy.get('tr[data-test-subj="reportJobRow"]').should('not.exist');
  }

  static deleteAllReports(reportTitle: string = 'Untitled discover search') {
    cy.log('deleteAllReports');

    // 1. Navigate to the Reporting page
    Reports.navigateTo();

    // 2. Check if there are any reports and if "Select All" is enabled
    cy.wait(5000);
    cy.get('body').then($body => {
      const hasReports = $body.find('tr[data-test-subj="reportJobRow"]').length > 0;
      const selectAllEnabled = $body.find('[data-test-subj="checkboxSelectAll"]').prop('checked') !== undefined; // Check if the checkbox exists and is enabled

      if (hasReports) {
        if (selectAllEnabled) {
          // If "Select All" is enabled, delete all reports directly
          cy.log('Deleting all reports using "Select All"');

          // Select all reports
          cy.get('[data-test-subj="checkboxSelectAll"]').check({force: true});

          // Click the "Delete" button
          cy.get('[data-test-subj="deleteReportButton"]').click({force: true});

          // Confirm the deletion in the modal
          cy.get('[data-test-subj="confirmModalConfirmButton"]').click({force: true});
        }
      } else {
        cy.log('No reports found - nothing to delete');
      }
    });
  }
}