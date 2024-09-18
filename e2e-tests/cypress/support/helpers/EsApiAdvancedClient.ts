import { EsApiClient } from './EsApiClient';

export class EsApiAdvancedClient extends EsApiClient {

  public pruneAllReportingIndices(): void {
    cy.log('Pruning all reporting indices...');
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

}

export const esApiAdvancedClient = new EsApiAdvancedClient();
