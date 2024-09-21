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
      cy.contains('Reporting').click();
    });
  }

  static checkAllReports(reportTitle: string = 'Untitled discover search') {
    cy.log('waitForAllReportsToBeDone');

    cy.get('tr[data-test-subj="reportJobRow"]', {timeout: 10000})
      .each($reportItem => {
        Reports.checkReportItem($reportItem, reportTitle);
      })
      .then($matchingReports => {
        expect($matchingReports).to.have.length(10);
      });
  }

  static checkReportItem($reportItem: JQuery<HTMLElement>, reportTitle: string) {
    cy.wrap($reportItem)
      .find('[data-test-subj="reportingListItemObjectTitle"]', {timeout: 10000})
      .should('contain.text', reportTitle);

    cy.wrap($reportItem)
      .find('[data-test-subj="reportJobStatus"]')
      .contains(/Done|Completed/, {timeout: 240000})
      .should('be.visible');
  }


  static verifyNoReports() {
    cy.log('verifyNoReports');

    // Assert that there are no report rows present
    cy.get('[data-test-subj="reportingListItemObjectTitle"]', {timeout: 10000}).should('not.exist');
  }

  static deleteAllReports(reportTitle: string = 'Untitled discover search') {
    cy.log('deleteAllReports');

    // Use curl command to remove the reporting index
    const elasticsearchUrl = Cypress.env('elasticsearchUrl');
    cy.exec(`curl -X DELETE "${ elasticsearchUrl }/reporting" -u kibana:kibana`)
      .then(response => {
        cy.log('All reports deleted');
      });
  }
}