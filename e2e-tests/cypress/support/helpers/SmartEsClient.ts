export class SmartEsClient {

  static pruneAllReportingIndices() {
    cy.log('Pruning all reporting indices...');
    cy.getRequest({ url: `${Cypress.env().elasticsearchUrl}/_cat/indices?format=json`, user: 'kibana:kibana' })
      .then((result: GetIndices[]) => {
        result
          .filter(index => index.index.startsWith('.reporting'))
          .forEach(reportingIndex => {
            SmartEsClient.deleteIndexDocsByQuery(reportingIndex.index);
            SmartEsClient.refreshIndex(reportingIndex.index);
          });
      });
    cy.log('Pruning all reporting indices - DONE!');
  }

  static deleteIndexDocsByQuery = (index: string) => {
    SmartEsClient.callEsEndpointUsingKibanaUser(
      "POST", `${index}/_delete_by_query`, `-H "Content-Type: application/json" -d '{"query": {"match_all": {}}}'`
    )
  }

  static refreshIndex = (index: string) => {
    SmartEsClient.callEsEndpointUsingKibanaUser("POST", `${index}/_refresh`)
  }

  static deleteIndex = (index: string) => {
    SmartEsClient.callEsEndpointUsingKibanaUser("DELETE", index)
  }

  static addDocument = (index: string, id: string, doc: Record<string, any>) => {
    SmartEsClient.callEsEndpointUsingKibanaUser("POST", `${index}/_doc/${id}`, `-H "Content-Type: application/json" -d '${JSON.stringify(doc)}'`)
  }

  static callEsEndpointUsingKibanaUser = (method: String, endpoint: String, curlParams: String = "") => {
    cy.exec(
      `curl -v -k -u kibana:kibana -H "kbn-xsrf: true" -X ${method} "${Cypress.env().elasticsearchUrl}/${endpoint}" ${curlParams}`
    )
  }
  
}

export interface GetIndices {
  index: string;
}