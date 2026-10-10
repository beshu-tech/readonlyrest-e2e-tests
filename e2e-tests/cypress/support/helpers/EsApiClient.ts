export class EsApiClient {
  public deleteIndexDocsByQuery(index: string): void {
    cy.esPost({
      endpoint: `${index}/_delete_by_query`,
      payload: {
        query: {
          match_all: {}
        }
      }
    });
  }

  public refreshIndex(index: string): void {
    cy.esPost({
      endpoint: `${index}/_refresh`
    });
  }

  public deleteIndex(index: string): void {
    cy.esDelete({
      endpoint: index,
      failOnStatusCode: false
    });
  }

  public deleteDataStream(index: string): void {
    cy.esDelete({
      endpoint: `_data_stream/${index}`
    });
  }

  public addDocument(index: string, id: string, doc: object): void {
    cy.esPost({
      endpoint: `${index}/_doc/${id}`,
      payload: doc
    });
  }

  public createIndex(index: string, settings?: object, mappings?: object): void {
    cy.esPut({
      endpoint: index,
      payload: {
        ...(settings && { settings }),
        ...(mappings && { mappings })
      }
    });
  }

  public indices(): Cypress.Chainable<GetIndices[]> {
    return cy.esGet<GetIndices[]>({
      endpoint: '_cat/indices?format=json&expand_wildcards=all'
    });
  }

  public dataStreams(): Cypress.Chainable<GetDataStreams> {
    return cy.esGet<GetDataStreams>({
      endpoint: '_data_stream?format=json&expand_wildcards=all'
    });
  }

  public findIndicesByPattern(pattern: string): Cypress.Chainable<GetIndices[]> {
    return cy.esGet<GetIndices[]>({
      endpoint: `_cat/indices/${pattern}?format=json`
    });
  }

  public attachLifecyclePolicy(index: string, policyName: string): void {
    cy.esPut({
      endpoint: `${index}/_settings`,
      payload: {
        'index.lifecycle.name': policyName
      }
    });
  }

  public rolloverIndex(index: string): void {
    cy.esPost({
      endpoint: `${index}/_rollover`
    });
  }
}

export const esApiClient = new EsApiClient();

export interface GetIndices {
  index: string;
  'docs.count': string;
  health: 'green' | 'yellow' | 'red';
}

export interface GetDataStreams {
  data_streams: {
    name: string;
  }[];
}
