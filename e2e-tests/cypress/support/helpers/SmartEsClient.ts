export class SmartEsClient {

  static pruneAllReportingIndices() {
    cy.log('Pruning all reporting indices...');
    cy.esGet({ endpoint: "_cat/indices?format=json", credentials: Cypress.env().kibanaUserCredentials })
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
    cy.esPost({
      endpoint: `${index}/_delete_by_query`,
      credentials: Cypress.env().kibanaUserCredentials,
      payload: {
        query: {
          match_all: {}
        }
      }
    })
  }

  static refreshIndex = (index: string) => {
    cy.esPost({
      endpoint: `${index}/_refresh`,
      credentials: Cypress.env().kibanaUserCredentials,
    })
  }

  static deleteIndex = (index: string) => {
    cy.esDelete({
      endpoint: index,
      credentials: Cypress.env().kibanaUserCredentials
    })
  }

  static addDocument = (index: string, id: string, doc: unknown) => {
    cy.esPost({
      endpoint: `${index}/_doc/${id}`,
      credentials: Cypress.env().kibanaUserCredentials,
      payload: doc
    })
  }
}

export interface GetIndices {
  index: string;
}