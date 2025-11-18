import * as semver from 'semver';
import type { GetIndices } from './EsApiClient';
import { EsApiClient } from './EsApiClient';
import { getKibanaVersion } from './index';

export class EsApiAdvancedClient extends EsApiClient {
  public pruneAllReportingIndices(): void {
    cy.log('Pruning all reporting indices...');

    if (semver.satisfies(getKibanaVersion(), '>=8.19.0 <9.0.0 || >=9.1.0')) {
      this.dataStreams().then(result => {
        result.data_streams
          .filter(dataStream => dataStream.name.startsWith('.kibana-reporting-'))
          .forEach(reportingDataStream => {
            this.deleteDataStream(reportingDataStream.name);
          });
      });
    } else {
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
