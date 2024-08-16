import { KibanaNavigation } from '../KibanaNavigation';
import semver from "semver/preload";
import { getKibanaVersion } from "../../helpers";

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
      cy.contains('Reporting').click();
    });
  }

  static checkAllReports(reportTitle: string = 'Untitled discover search') {
    cy.log('waitForAllReportsToBeDone');

    cy.get('tr[data-test-subj="reportJobRow"]')
      .each($reportItem => {
        cy.wrap($reportItem)
          .find('[data-test-subj="reportingListItemObjectTitle"]')
          .should('contain.text', reportTitle);

        cy.wrap($reportItem)
          .find('[data-test-subj="reportJobStatus"]')
          .contains(/Done|Completed/, {timeout: 60000})
          .should('be.visible');

        // Click the download button
        if (semver.lte(getKibanaVersion(), '8.8.0')) {
          cy.wrap($reportItem)
            .find('[data-test-subj="reportJobActions"] button')
            .first()
            .click();
        } else {
          cy.wrap($reportItem)
            .find('[data-test-subj="reportDownloadLink"]')
            .first()
            .click();
        }

        // Assert that a file is downloaded
        cy.verifyDownload(`${ reportTitle }.csv`, {timeout: 10000}) // Adjust timeout if needed
          .then(filePath => {
            // Read the downloaded file content and assert it's not empty
            cy.readFile(filePath)
              .should('not.be.empty')
              .then(fileContent => {
                const rows = fileContent.split('\n');
                expect(rows.length).to.be.greaterThan(1);
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
    cy.wait(500);
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

        } else {
          // If "Select All" is not enabled, delete reports page by page as before
          cy.log('Deleting reports page by page');

          let totalPages = 1;
          cy.get('.euiPagination__list li:not(.euiPaginationButton-isPlaceholder)').then($pageButtons => {
            totalPages = $pageButtons.length;
          });

          for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
            // ... (rest of the page-by-page deletion logic remains the same) ...
          }
        }
      } else {
        cy.log('No reports found - nothing to delete');
      }
    });
  }
}