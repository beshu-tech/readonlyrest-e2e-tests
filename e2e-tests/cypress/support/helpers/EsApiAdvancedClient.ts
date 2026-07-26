import * as semver from 'semver';
import type { GetIndices } from './EsApiClient';
import { EsApiClient } from './EsApiClient';
import { getKibanaVersion } from './index';

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

    // Pre-8.19 also has the legacy .reporting* indices; purge their docs too.
    if (!semver.satisfies(getKibanaVersion(), '>=8.19.0 <9.0.0 || >=9.1.0')) {
      this.indices().then(result => {
        result
          .filter(index => index.index.startsWith('.reporting'))
          .forEach(reportingIndex => {
            this.deleteIndexDocsByQuery(reportingIndex.index);
            this.refreshIndex(reportingIndex.index);
          });
      });
    }

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
  ): Cypress.Chainable<void> {
    const startTime = Date.now();

    const checkCount = (): Cypress.Chainable<void> =>
      this.getAllReportingDataStreamSegments(indexName).then(segments => {
        const total = segments.reduce((sum, seg) => sum + Number.parseInt(seg['docs.count'] ?? '0', 10), 0);
        cy.log(`Reporting segments for ${indexName}: docs ${total}/${expectedDocs}`);
        if (total >= expectedDocs) {
          return;
        }
        if (Date.now() - startTime >= timeout) {
          throw new Error(
            `Timeout waiting for ${expectedDocs} report docs in ${indexName} segments (current: ${total}) after ${timeout / 1000}s`
          );
        }
        // Return the recursive chain so Cypress waits for the full poll to
        // resolve before advancing (matches verifyAllDataStreamsSegmentsCount).
        return cy.wait(interval).then(checkCount);
      });

    return cy.wrap(null).then(checkCount);
  }

  public waitForDocsCount(
    indexName: string,
    expectedCount = 0,
    timeout = 10000,
    interval = 1000
  ): Cypress.Chainable<GetIndices[]> {
    const startTime = Date.now();
    cy.log(`Waiting for index ${indexName} to have ${expectedCount} documents...`);

    const checkCount = (): Cypress.Chainable<GetIndices[]> =>
      this.findIndicesByPattern(indexName).then(result => {
        const foundIndex = result.find(({ index }) => index === indexName);
        if (!foundIndex) {
          throw new Error(`Index ${indexName} not found`);
        }

        const currentCount = Number.parseInt(foundIndex['docs.count'], 10);
        cy.log(`Index: ${indexName}, Current docs.count: ${currentCount}, Expected: ${expectedCount}`);

        // Success case
        if (currentCount === expectedCount) {
          return;
        }

        // Timeout case
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          throw new Error(
            `Timeout waiting for docs.count to be ${expectedCount} (current: ${currentCount}) after ${timeout / 1000}s`
          );
        }

        // Continue polling
        cy.wait(interval).then(checkCount);
      });

    return cy.wrap(null).then(checkCount);
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
