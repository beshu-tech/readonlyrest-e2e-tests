import { recurse } from 'cypress-recurse';
import { RorMenu } from './RorMenu';
import { StackManagement } from './StackManagement';
import { kibanaVersion } from '../helpers';
import { esApiAdvancedClient } from '../helpers/EsApiAdvancedClient';
import { KibanaToast } from './KibanaToast';
import type { Interception } from 'cypress/types/net-stubbing';

type OpenBy = 'rorMenu' | 'kibanaNavigation';

export class Reporting {
  // The empty-list text alone also shows when the list request fails, so every list answer of the
  // page must be a 200 with no reports.
  static noReportsCreatedCheck(openBy: OpenBy) {
    cy.log('noReportsCreatedCheck');
    cy.intercept({ method: 'GET', pathname: /\/(api|internal)\/reporting\/jobs\/list$/ }, req => {
      delete req.headers['if-none-match'];
    }).as('reportsList');
    this.openReportingPage(openBy);
    cy.contains('No reports have been created').should('be.visible');
    cy.get<Interception[]>('@reportsList.all').should(interceptions => {
      const answered = interceptions.filter(interception => interception.response);
      expect(answered.length, 'answered report list requests').to.be.greaterThan(0);
      answered.forEach(({ response }) => {
        expect(response?.statusCode, 'report list status').to.equal(200);
        expect(response?.body, 'report list').to.be.an('array').that.has.length(0);
      });
    });
  }

  static verifySavedReport(reportNames: (string | RegExp)[]) {
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
        cy.wrap($row)
          .contains(/Done|Completed/)
          .should('be.visible');
      });
    }
  }

  static verifyIfReportingPageAfterRefresh() {
    cy.log('Verify if reporting page open after refresh');
    // Kibana 8.19 and 9.1+ redirect the reporting page to /exports. 9.0 keeps the bare path.
    const expectedUrl = kibanaVersion.has91Features()
      ? `${Cypress.config().baseUrl}/s/default/app/management/insightsAndAlerting/reporting/exports`
      : `${Cypress.config().baseUrl}/s/default/app/management/insightsAndAlerting/reporting`;

    cy.url().should('include', expectedUrl);

    cy.reload();

    cy.url().should('include', expectedUrl);
  }

  static removeReport(reportName: string | RegExp) {
    cy.log('remove report');
    cy.get('[data-test-subj=reportJobRow]')
      .contains(reportName)
      .closest('[data-test-subj=reportJobRow]')
      .find('[type=checkbox]')
      .click();
    if (kibanaVersion.gte('9.3.0')) {
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

  /**
   * Downloads the first report without assuming its filename matches the saved search name (see
   * verifyReportsCount).
   *
   * Kibana's download button calls window.open() with the report URL, and Cypress does not control
   * that window. On Kibana 9.5.5 it often never requests the URL (locally 6 of 6 runs, CI 2 runs), so
   * no file arrives. So the test checks that the click opens the report URL, then fetches that URL
   * with the browser session and checks the CSV.
   */
  static downloadAndVerifyAnyReportExists() {
    cy.log('download report (title-agnostic)');
    cy.window().then(win => {
      cy.stub(win, 'open').as('openReport');
    });

    if (kibanaVersion.gte('8.0.0')) {
      cy.get('[data-test-subj="reportJobRow"]').eq(0).find('[data-test-subj^="reportDownloadLink-"]').click();
    } else {
      cy.get('[data-test-subj="reportJobRow"]').eq(0).find('[aria-label="Download report"]').click();
    }

    cy.get<sinon.SinonStub>('@openReport')
      .should('have.been.calledOnce')
      .then(openReport => {
        const url = String(openReport.firstCall.args[0]);
        expect(url, 'report URL').to.match(/\/reporting\/jobs\/download\//);
        cy.request(url).then(response => {
          expect(response.status, `GET ${url}`).to.equal(200);
          expect(response.headers['content-type'], 'report content type').to.match(/text\/csv/);
          expect(String(response.body), 'report body').to.have.length.greaterThan(0);
        });
      });
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

      sortedStreams.forEach((dataStream, segmentIndex) =>
        expect(
          dataStream.index.endsWith(`00000${segmentIndex + 1}`),
          `Expected index "${dataStream.index}" to end with "00000${segmentIndex + 1}"`
        ).to.equal(true)
      );
    });
  }
}
