import { EsApiClient } from './EsApiClient';

export class EsApiAdvancedClient extends EsApiClient {

  public static instance: EsApiAdvancedClient = new EsApiAdvancedClient();

  public pruneAllReportingIndices(): void {
    cy.log('Pruning all reporting indices...');
    this.indices().then(result => {
      result
        .filter(index => index.index.startsWith('.reporting'))
        .forEach(reportingIndex => {
          EsApiClient.instance.deleteIndexDocsByQuery(reportingIndex.index);
          EsApiClient.instance.refreshIndex(reportingIndex.index);
        });
    });
    cy.log('Pruning all reporting indices - DONE!');
  }

}