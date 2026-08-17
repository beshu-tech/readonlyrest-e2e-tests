import { recurse } from 'cypress-recurse';
import { EsApiClient } from './EsApiClient';

export class EsApiAdvancedClient extends EsApiClient {
  public pruneAllReportingIndices(): void {
    cy.log('Pruning all reporting indices...');

    // Reporting has used data streams (.kibana-reporting-*, backed by hidden
    // .ds-* indices) since 8.15; drop them in every version so stale docs from a
    // prior run can't satisfy waitForReportingSegmentsDocsCount before the current
    // export lands. No-op when none exist.
    this.dataStreams().then(result => {
      result.data_streams
        .filter(dataStream => dataStream.name.startsWith('.kibana-reporting-'))
        .forEach(reportingDataStream => {
          this.deleteDataStream(reportingDataStream.name);
        });
    });

    // The legacy .reporting* indices hold reports too, in every version: the reporting page lists
    // what it finds in both places, and a test writes an old-format doc to prove it. Purge their
    // docs as well, or a report the page still shows outlives the test that made it.
    this.indices().then(result => {
      result
        .filter(index => index.index.startsWith('.reporting'))
        .forEach(reportingIndex => {
          this.deleteIndexDocsByQuery(reportingIndex.index);
          this.refreshIndex(reportingIndex.index);
        });
    });

    cy.log('Pruning all reporting indices - DONE!');
  }

  public getAllReportingIndices() {
    cy.log('Getting all reporting indices...');
    return this.indices().then(result => result.filter(index => index.index.startsWith('.reporting')));
  }

  public getAllReportingDataStreamSegments(indexName: string) {
    cy.log('Getting all reporting data stream segments...');
    return this.indices().then(result =>
      result.filter(index => index.index.startsWith(`.ds-.kibana-reporting-${indexName}`))
    );
  }

  // exportToCsv returns when the report is QUEUED, not written. Poll the segments'
  // combined docs.count (refresh-visible) until the report doc shows up, so a
  // following rollover doesn't race the write and land the report in the wrong segment.
  public waitForReportingSegmentsDocsCount(
    indexName: string,
    expectedDocs: number,
    timeout = 30000,
    interval = 1000
  ): Cypress.Chainable<number> {
    return recurse(
      () =>
        this.getAllReportingDataStreamSegments(indexName).then(segments =>
          segments.reduce((sum, seg) => sum + Number.parseInt(seg['docs.count'] ?? '0', 10), 0)
        ),
      total => total >= expectedDocs,
      {
        timeout,
        delay: interval,
        log: total => cy.log(`Reporting segments for ${indexName}: docs ${total}/${expectedDocs}`),
        error: `Timeout waiting for ${expectedDocs} report docs in ${indexName} segments`
      }
    );
  }

  public waitForDocsCount(
    indexName: string,
    expectedCount = 0,
    timeout = 10000,
    interval = 1000
  ): Cypress.Chainable<number> {
    cy.log(`Waiting for index ${indexName} to have ${expectedCount} documents...`);

    return recurse(
      () =>
        this.findIndicesByPattern(indexName).then(result => {
          const foundIndex = result.find(({ index }) => index === indexName);
          // Thrown from the polled command rather than the predicate, so it fails the test outright
          // instead of being retried: a missing index will not appear by waiting.
          if (!foundIndex) {
            throw new Error(`Index ${indexName} not found`);
          }
          return Number.parseInt(foundIndex['docs.count'], 10);
        }),
      currentCount => currentCount === expectedCount,
      {
        timeout,
        delay: interval,
        log: currentCount =>
          cy.log(`Index: ${indexName}, Current docs.count: ${currentCount}, Expected: ${expectedCount}`),
        error: `Timeout waiting for docs.count of ${indexName} to be ${expectedCount}`
      }
    );
  }

  public deleteIndicesByPattern(pattern: string): void {
    cy.log(`Deleting indices matching pattern ${pattern}...`);
    this.indices().then(result => {
      const regex = new RegExp(pattern);
      const matchingIndices = result.filter(indexObj => regex.test(indexObj.index));
      matchingIndices.forEach(matchingIndex => {
        cy.log(`Deleting index ${matchingIndex.index}...`);
        this.deleteIndex(matchingIndex.index);
      });
    });
  }

  public deleteDataStreamsByPattern(pattern: string): void {
    cy.log(`Deleting data streams matching pattern ${pattern}...`);
    this.dataStreams().then(result => {
      const regex = new RegExp(pattern);
      const matchingIndices = result.data_streams.filter(indexObj => regex.test(indexObj.name));
      matchingIndices.forEach(matchingIndex => {
        cy.log(`Deleting index ${matchingIndex.name}...`);
        this.deleteDataStream(matchingIndex.name);
      });
    });
  }
}

export const esApiAdvancedClient = new EsApiAdvancedClient();
