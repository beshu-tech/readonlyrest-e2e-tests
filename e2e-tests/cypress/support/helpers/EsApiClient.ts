export class EsApiClient {
  public deleteIndexDocsByQuery(index: string): void {
    cy.esPost({
      endpoint: `${index}/_delete_by_query`,
      credentials: Cypress.env().kibanaUserCredentials,
      payload: {
        query: {
          match_all: {}
        }
      }
    });
  }

  public refreshIndex(index: string): void {
    cy.esPost({
      endpoint: `${index}/_refresh`,
      credentials: Cypress.env().kibanaUserCredentials
    });
  }

  public deleteIndex(index: string): void {
    cy.esDelete({
      endpoint: index,
      credentials: Cypress.env().kibanaUserCredentials
    });
  }

  public deleteDataStream(index: string): void {
    cy.esDelete({
      endpoint: `_data_stream/${index}`,
      credentials: Cypress.env().kibanaUserCredentials
    });
  }

  public addDocument(index: string, id: string, doc: object): void {
    cy.esPost({
      endpoint: `${index}/_doc/${id}`,
      credentials: Cypress.env().kibanaUserCredentials,
      payload: doc
    });
  }

  public indices(): Cypress.Chainable<GetIndices[]> {
    return cy.esGet({
      endpoint: '_cat/indices?format=json',
      credentials: Cypress.env().kibanaUserCredentials
    });
  }

  public dataStreams(): Cypress.Chainable<GetDataStreams> {
    return cy.esGet({
      endpoint: '_data_stream?format=json&expand_wildcards=all',
      credentials: Cypress.env().kibanaUserCredentials
    });
  }

  public attachLifecyclePolicy(index: string, policyName: string): void {
    cy.esPut({
      endpoint: `${index}/_settings`,
      credentials: Cypress.env().kibanaUserCredentials,
      payload: {
        'index.lifecycle.name': policyName
      }
    });
  }
}

export const esApiClient = new EsApiClient();

export interface GetIndices {
  index: string;
}

export interface GetDataStreams {
  data_streams: {
    name: string;
  }[];
}
