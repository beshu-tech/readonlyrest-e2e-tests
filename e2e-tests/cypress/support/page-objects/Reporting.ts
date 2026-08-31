import * as semver from 'semver';
import { recurse } from 'cypress-recurse';
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

  /**
   * Title-agnostic alternative to verifySavedReport. On Kibana <9.0.0, a CSV report generated
   * shortly after saving a Discover session can be persisted with payload.title "Untitled
   * Discover session" instead of the session's actual saved name (confirmed via proxy-level ES
   * response logging - a title-binding race distinct from, and not fixed by, the reopen done in
   * Discover.saveReport for >=9.0.0). Use this where the test only needs to confirm a report was
   * generated and completed, not that its title matches the saved search name.
   */
  static verifyReportsCount(count: number) {
    cy.log('verifyReportsCount');
    cy.get('[data-test-subj=reportJobRow]').should('have.length', count);
    if (count > 0) {
      cy.get('[data-test-subj=reportJobRow]').each($row => {
        cy.wrap($row).contains(/Done|Completed/).should('be.visible');
      });
    }
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

  /**
   * Title-agnostic alternative to downloadAndVerifyReportExists: downloads the first report
   * without assuming its filename matches the saved search name (see verifyReportsCount).
   */
  static downloadAndVerifyAnyReportExists(timeout = 20000, interval = 500) {
    cy.log('download report (title-agnostic)');

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.get('[data-test-subj="reportJobRow"]').eq(0).find('[data-test-subj^="reportDownloadLink-"]').click();
    } else {
      cy.get('[data-test-subj="reportJobRow"]').eq(0).find('[aria-label="Download report"]').click();
    }

    const startTime = Date.now();

    const check = (): Cypress.Chainable<undefined> =>
      cy.task<string[]>('listDownloadedFiles').then((files): Cypress.Chainable<undefined> => {
        if (files.some(file => file.endsWith('.csv'))) {
          // Cypress 14's wrap() overloads infer Chainable<JQuery<undefined>> for a bare undefined;
          // the cast keeps this branch aligned with check()'s Chainable<undefined> signature.
          return cy.wrap(undefined) as Cypress.Chainable<undefined>;
        }
        if (Date.now() - startTime >= timeout) {
          throw new Error(`Timeout waiting for a downloaded .csv file after ${timeout / 1000}s (found: ${files})`);
        }
        return cy.wait(interval).then(check);
      });

    return cy.wrap(null).then(check);
  }

  static verifyAllDataStreamsSegmentsCount(index: string, numberOfSegments: number, timeout = 30000) {
    // Segment creation after a rollover is async, so poll instead of asserting on
    // a single snapshot that could catch an intermediate state.
    return recurse(
      () => esApiAdvancedClient.getAllReportingDataStreamSegments(index),
      dataStreams => dataStreams.length === numberOfSegments,
      {
        timeout,
        delay: 1000,
        log: dataStreams => cy.log(`Reporting segments for ${index}: ${dataStreams.length}/${numberOfSegments}`),
        error: `Expected ${numberOfSegments} data stream segment(s) for ${index}`
      }
    ).then(dataStreams => {
      const sortedStreams = [...dataStreams].sort((a, b) => a.index.localeCompare(b.index));

      sortedStreams.forEach(
        (dataStream, segmentIndex) =>
          expect(
            dataStream.index.endsWith(`00000${segmentIndex + 1}`),
            `Expected index "${dataStream.index}" to end with "00000${segmentIndex + 1}"`
          ).to.be.true
      );
    });
  }
}
