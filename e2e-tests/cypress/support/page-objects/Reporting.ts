import * as semver from 'semver';
import { RorMenu } from './RorMenu';
import { StackManagement } from './StackManagement';
import { getKibanaVersion } from '../helpers';

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
      cy.contains(reportName)
        .closest('[data-test-subj=reportJobRow]')
        .contains(/Done|Completed/)
        .should('be.visible');
    });
    cy.get('[data-test-subj=reportJobRow]').should('have.length', reportNames.length);
  }

  static verifyIfReportingPageAfterRefresh() {
    cy.log('Verify if reporting page open after refresh');
    const expectedUrl =
      semver.gte(getKibanaVersion(), '8.19.0') && semver.lt(getKibanaVersion(), '9.0.0')
        ? `${Cypress.config().baseUrl}/s/default/app/management/insightsAndAlerting/reporting/exports`
        : `${Cypress.config().baseUrl}/s/default/app/management/insightsAndAlerting/reporting`;

    cy.url().should('include', expectedUrl);

    cy.reload();

    cy.url().should('include', expectedUrl);
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
