import { EsApiClient } from './EsApiClient';
import * as semver from 'semver';
import { getKibanaVersion } from './index';

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
}

export const esApiAdvancedClient = new EsApiAdvancedClient();
