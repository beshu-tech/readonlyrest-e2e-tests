import * as semver from 'semver';
import { getKibanaVersion } from './index';
import { EsApiClient, GetIndices } from './EsApiClient';

export class EsApiAdvancedClient extends EsApiClient {
  public pruneAllReportingIndices(): void {
    cy.log('Pruning all reporting indices...');

    if (semver.gte(getKibanaVersion(), '8.19.0') && semver.lt(getKibanaVersion(), '9.0.0')) {
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
}

export const esApiAdvancedClient = new EsApiAdvancedClient();
