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
    })
  }

  public refreshIndex(index: string): void {
    cy.esPost({
      endpoint: `${index}/_refresh`,
      credentials: Cypress.env().kibanaUserCredentials,
    })
  }

  public deleteIndex(index: string): void {
    cy.esDelete({
      endpoint: index,
      credentials: Cypress.env().kibanaUserCredentials
    })
  }

  public addDocument(index: string, id: string, doc: unknown): void {
    cy.esPost({
      endpoint: `${index}/_doc/${id}`,
      credentials: Cypress.env().kibanaUserCredentials,
      payload: doc
    })
  }

  public indices(): Cypress.Chainable<GetIndices[]> {
    return cy
      .esGet({
        endpoint: "_cat/indices?format=json",
        credentials: Cypress.env().kibanaUserCredentials
      })
  }
}

export const esApiClient = new EsApiClient();

export interface GetIndices {
  index: string;
}