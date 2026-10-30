import { kibanaCredentials } from './credentials';
import type { HttpResponse } from '../types';

export class EsApiClient {
  public deleteIndexDocsByQuery(index: string): void {
    cy.esPost({
      endpoint: `${index}/_delete_by_query`,
      credentials: kibanaCredentials,
      payload: {
        query: {
          match_all: {}
        }
      }
    });
  }

  // Yields the status and the body, and never fails on the status.
  public searchResponse<T>(index: string, payload: object): Cypress.Chainable<HttpResponse<T>> {
    return cy.esResponse<T>({
      method: 'POST',
      endpoint: `${index}/_search`,
      credentials: kibanaCredentials,
      payload
    });
  }

  public refreshIndex(index: string): void {
    cy.esPost({
      endpoint: `${index}/_refresh`,
      credentials: kibanaCredentials
    });
  }

  public deleteIndex(index: string): void {
    cy.esDelete({
      endpoint: index,
      credentials: kibanaCredentials,
      failOnStatusCode: false
    });
  }

  // A wildcard also matches hidden data streams, as the 10m and 60m APM metrics.
  public deleteDataStream(index: string): void {
    cy.esDelete({
      endpoint: `_data_stream/${index}?expand_wildcards=all`,
      credentials: kibanaCredentials
    });
  }

  public addDocument(index: string, id: string, doc: object): void {
    cy.esPost({
      endpoint: `${index}/_doc/${id}`,
      credentials: kibanaCredentials,
      payload: doc
    });
  }

  public createIndex(index: string, settings?: object, mappings?: object): void {
    cy.esPut({
      endpoint: index,
      credentials: kibanaCredentials,
      payload: {
        ...(settings && { settings }),
        ...(mappings && { mappings })
      }
    });
  }

  public indices(): Cypress.Chainable<GetIndices[]> {
    return cy.esGet<GetIndices[]>({
      endpoint: '_cat/indices?format=json&expand_wildcards=all',
      credentials: kibanaCredentials
    });
  }

  public dataStreams(): Cypress.Chainable<GetDataStreams> {
    return cy.esGet<GetDataStreams>({
      endpoint: '_data_stream?format=json&expand_wildcards=all',
      credentials: kibanaCredentials
    });
  }

  public findIndicesByPattern(pattern: string): Cypress.Chainable<GetIndices[]> {
    return cy.esGet<GetIndices[]>({
      endpoint: `_cat/indices/${pattern}?format=json`,
      credentials: kibanaCredentials
    });
  }

  public attachLifecyclePolicy(index: string, policyName: string): void {
    cy.esPut({
      endpoint: `${index}/_settings`,
      credentials: kibanaCredentials,
      payload: {
        'index.lifecycle.name': policyName
      }
    });
  }

  public rolloverIndex(index: string): void {
    cy.esPost({
      endpoint: `${index}/_rollover`,
      credentials: kibanaCredentials
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
