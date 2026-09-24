import { recurse } from 'cypress-recurse';

export class KbnApiClient {
  public getDataViews(credentials: BasicCredentials, group?: string): Cypress.Chainable<DataViews> {
    return cy
      .kbnGet<DataViews>({
        endpoint: 'api/data_views',
        credentials,
        currentGroupHeader: group
      })
      .then(result => {
        // A request that Kibana has logged out gets a 2xx login page instead of the JSON.
        if (!Array.isArray(result?.data_view)) {
          throw new Error(
            `api/data_views did not answer with { data_view: [...] } for ${accountOf(credentials)}` +
              `${inTenancy(group)}. Body: ${describeBody(result)}`
          );
        }
        return result;
      });
  }

  public createDataView(dataView: object, credentials: string, group?: string): void {
    cy.kbnPost({
      endpoint: 'api/data_views/data_view',
      credentials,
      currentGroupHeader: group,
      payload: dataView
    });
  }

  public deleteDataView(dataViewId: string, credentials: string, group?: string): void {
    cy.kbnDelete({
      endpoint: `api/data_views/data_view/${dataViewId}`,
      credentials,
      currentGroupHeader: group
    });
  }

  public getSavedObjects(
    credentials: string,
    group?: string,
    { failOnStatusCode = true }: { failOnStatusCode?: boolean } = {}
  ): Cypress.Chainable<GetObject> {
    return cy.kbnGet<GetObject>({
      endpoint: 'api/saved_objects/_find?type=index-pattern&type=search&type=visualization&type=dashboard&type=url',
      credentials,
      currentGroupHeader: group,
      failOnStatusCode
    });
  }

  public deleteSavedObject(
    savedObject: SavedObject,
    credentials: string,
    group?: string,
    { failOnStatusCode = true }: { failOnStatusCode?: boolean } = {}
  ): void {
    cy.kbnDelete({
      endpoint: `api/saved_objects/${savedObject.type}/${savedObject.id}`,
      credentials,
      currentGroupHeader: group,
      failOnStatusCode
    });
  }

  /**
   * Kibana's sample-data installer deletes the previous index and recreates it in one request;
   * those two steps occasionally race each other (resource_already_exists_exception -> 500).
   * That failure resolves rather than rejecting (failOnStatusCode: false), so the fixed-interval
   * retry below gets a chance to let the race settle. A cy.task timeout does not: it rejects the
   * chain, cypress-recurse does not retry on rejection, and the loop ends immediately. So
   * timeoutMs must, on its own, outlast the bulk-insert that follows a successful create - the
   * retry budget below cannot cover a run where that insert is slower than timeoutMs.
   */
  public loadSampleData(
    sampleDatasetName: string,
    credentials: string,
    group?: string
  ): Cypress.Chainable<{ statusCode?: number; elasticsearchIndicesCreated?: Record<string, number> }> {
    return recurse(
      () =>
        cy.kbnPost<{ statusCode?: number; elasticsearchIndicesCreated?: Record<string, number> }>({
          endpoint: `api/sample_data/${sampleDatasetName}`,
          credentials,
          currentGroupHeader: group,
          failOnStatusCode: false,
          timeoutMs: 30000
        }),
      response => response?.elasticsearchIndicesCreated !== undefined,
      {
        timeout: 90000,
        delay: 5000,
        log: response => cy.log(`Load sample data "${sampleDatasetName}" response: ${JSON.stringify(response)}`),
        error: `Timed out loading sample data "${sampleDatasetName}"`
      }
    );
  }

  public deleteSampleData(sampleDatasetName: string, credentials: string, group?: string): void {
    cy.kbnDelete({
      endpoint: `api/sample_data/${sampleDatasetName}`,
      credentials,
      currentGroupHeader: group
    });
  }

  public deleteSpace(spaceName: string, credentials: string, group?: string): void {
    cy.kbnDelete({
      endpoint: `api/spaces/space/${spaceName}`,
      credentials,
      currentGroupHeader: group
    });
  }

  public getAllSpaces(credentials: BasicCredentials, group?: string): Cypress.Chainable<Space[]> {
    return cy
      .kbnGet<Space[]>({
        endpoint: `api/spaces/space`,
        credentials,
        currentGroupHeader: group
      })
      .then(spaces => {
        // A request that Kibana has logged out gets a 2xx login page instead of the JSON.
        if (!Array.isArray(spaces)) {
          throw new Error(
            `api/spaces/space did not answer with a list of spaces for ${accountOf(credentials)}` +
              `${inTenancy(group)}. Body: ${describeBody(spaces)}`
          );
        }
        return spaces;
      });
  }

  public createShortUrl(
    payload: ShortUrlPayload,
    credentials: string,
    group?: string
  ): Cypress.Chainable<ShortUrlResponse> {
    return cy.kbnPost<ShortUrlResponse>({
      endpoint: 's/default/api/short_url',
      credentials,
      currentGroupHeader: group,
      payload
    });
  }

  public createShortUrlLegacy(credentials: string, group?: string): Cypress.Chainable<ShortUrlResponse> {
    return cy.kbnPost<ShortUrlResponse>({
      endpoint: 'api/saved_objects/url',
      credentials,
      currentGroupHeader: group,
      payload: {
        attributes: {
          url: '/app/discover',
          accessCount: 0,
          createDate: new Date().toISOString(),
          accessDate: new Date().toISOString()
        }
      }
    });
  }
}

export const kbnApiClient = new KbnApiClient();

interface DataView {
  id: string;
}

export interface DataViews {
  data_view: DataView[];
}

interface SavedObject {
  type: string;
  id: string;
}

export interface GetObject {
  saved_objects: SavedObject[];
}

interface Space {
  id: string;
  name: string;
  initials: string;
  color: string;
  disabledFeatures: string[];
  imageUrl: string;
}

export interface ShortUrlPayload {
  locatorId: string;
  params: Record<string, unknown>;
}

export interface ShortUrlResponse {
  id: string;
}

export type BasicCredentials = `${string}:${string}`;

// CI keeps its logs, so a message names the account and never the pair.
const accountOf = (credentials: BasicCredentials): string => credentials.split(':')[0];

const inTenancy = (group?: string): string => (group ? ` in ${group}` : '');

const describeBody = (data: unknown): string => {
  const shown = typeof data === 'string' ? data : JSON.stringify(data) ?? String(data);
  return shown.length > 2000 ? `${shown.slice(0, 2000)}…` : shown;
};
