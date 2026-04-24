import * as semver from 'semver';
import { RorMenu } from './RorMenu';
import { StackManagement } from './StackManagement';
import { getKibanaVersion } from '../helpers';
import { esApiAdvancedClient } from '../helpers/EsApiAdvancedClient';
import { KibanaToast } from './KibanaToast';

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
    const expectedUrl = semver.satisfies(getKibanaVersion(), '>=8.19.0 <9.0.0')
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
    if (semver.gte(getKibanaVersion(), '9.3.0')) {
      KibanaToast.closeToastMessage();
    }
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

  static downloadAndVerifyReportExists(reportName: string) {
    cy.log('download Report');

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.get('[data-test-subj="reportJobRow"]').eq(0).find('[data-test-subj^="reportDownloadLink-"]').click();
    } else {
      cy.get('[data-test-subj="reportJobRow"]').eq(0).find('[aria-label="Download report"]').click();
    }

    cy.readFile(`cypress/downloads/${reportName}.csv`, 'binary', { timeout: 20000 }).should(
      'have.length.greaterThan',
      0
    );
  }

  static verifyAllDataStreamsSegmentsCount(index: string, numberOfSegments: number) {
    esApiAdvancedClient.getAllReportingDataStreamSegments(index).then(dataStreams => {
      expect(dataStreams.length).to.equal(numberOfSegments);
      const sortedStreams = [...dataStreams].sort((a, b) => a.index.localeCompare(b.index));

      sortedStreams.forEach(
        (dataStream, index) =>
          expect(
            dataStream.index.endsWith(`00000${index + 1}`),
            `Expected index "${dataStream.index}" to end with "00000${index + 1}"`
          ).to.be.true
      );
    });
  }
}
