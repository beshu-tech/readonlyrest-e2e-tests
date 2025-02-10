import { RorMenu } from './RorMenu';
import { StackManagement } from './StackManagement';

type OpenBy = 'rorMenu' | 'kibanaNavigation';

export class Reporting {
  static noReportsCreatedCheck(openBy: OpenBy) {
    cy.log('noReportsCreatedCheck');
    this.openReportingPage(openBy);
    cy.contains('No reports have been created').should('be.visible');
  }

  static verifySavedReport(reportNames: string[]) {
    cy.log('verifySavedReport');
    reportNames.forEach(reportName => {
      cy.contains(reportName).should('be.visible');
      cy.contains(reportName).closest('[data-test-subj=reportJobRow]').contains(/Done/).should('be.visible');
    });
    cy.get('[data-test-subj=reportJobRow]').should('have.length', reportNames.length);
  }

  static verifyIfReportingPageAfterRefresh() {
    cy.log('Verify if reporting page open after refresh');
    cy.url().should('include', `${Cypress.config().baseUrl}/s/default/app/management/insightsAndAlerting/reporting`);
    cy.reload();
    cy.url().should('include', `${Cypress.config().baseUrl}/s/default/app/management/insightsAndAlerting/reporting`);
  }

  static removeReport(reportName: string) {
    cy.log('remove report');
    cy.get('[data-test-subj=reportJobRow]')
      .contains(reportName)
      .closest('[data-test-subj=reportJobRow]')
      .find('[type=checkbox]')
      .click();
    cy.get('[data-test-subj=deleteReportButton]').click();
    cy.get('[data-test-subj=confirmModalConfirmButton]').click();
  }

  static openReportingPage(openBy: OpenBy) {
    if (openBy === 'rorMenu') {
      RorMenu.openReportingPage();
      Reporting.verifyIfReportingPageAfterRefresh();
    } else {
      StackManagement.openReportingPage();
    }
  }
}
