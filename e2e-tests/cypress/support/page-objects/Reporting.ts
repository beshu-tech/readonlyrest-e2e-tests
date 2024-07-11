import { RorMenu } from './RorMenu';
import { StackManagement } from './StackManagement';

type OpenBy = 'rorMenu' | 'kibanaNavigation';

export class Reporting {
  static noReportsCreatedCheck(openBy: OpenBy) {
    cy.log('noReportsCreatedCheck');
    this.openReportingPage(openBy);
    cy.contains('No reports have been created').should('be.visible');
  }

  static verifySavedReport(reportName: string, openBy: OpenBy, reportsCount) {
    cy.log('verifySavedReport');
    this.openReportingPage(openBy);
    cy.contains(reportName).should('be.visible');
    cy.get('[data-test-subj=reportJobListing]').get('.euiTableRow').should('have.length', reportsCount);
  }

  static verifyIfReportingPageAfterRefresh() {
    cy.log('Verify if reporting page open after refresh');
    cy.url().should('include', `${Cypress.config().baseUrl}/s/default/app/management/insightsAndAlerting/reporting`);
    cy.reload();
    cy.url().should('include', `${Cypress.config().baseUrl}/s/default/app/management/insightsAndAlerting/reporting`);
  }
  private static openReportingPage(openBy: OpenBy) {
    if (openBy === 'rorMenu') {
      RorMenu.openReportingPage();
      Reporting.verifyIfReportingPageAfterRefresh();
    } else {
      StackManagement.openReportingPage();
    }
  }
}
