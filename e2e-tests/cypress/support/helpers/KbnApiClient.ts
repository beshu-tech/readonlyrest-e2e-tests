import { recurse } from 'cypress-recurse';

export class KbnApiClient {
  public getDataViews(credentials: string, group?: string): Cypress.Chainable<DataViews> {
    return cy.kbnGet<DataViews>({
      endpoint: 'api/data_views',
      credentials,
      currentGroupHeader: group
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
   * those two steps occasionally race each other (resource_already_exists_exception -> 500), and
   * the bulk-insert that follows a successful create is too slow for the shared httpCall timeout.
   * Give this call more room per attempt and retry with backoff so the race gets to resolve
   * itself instead of failing the test.
   */
  public loadSampleData(
    sampleDatasetName: string,
    credentials: string,
    group?: string,
    timeout = 90000,
    interval = 5000
  ): Cypress.Chainable<{ statusCode?: number }> {
    return recurse(
      () =>
        cy.kbnPost<{ statusCode?: number }>({
          endpoint: `api/sample_data/${sampleDatasetName}`,
          credentials,
          currentGroupHeader: group,
          failOnStatusCode: false,
          timeoutMs: 30000
        }),
      response => !response?.statusCode,
      {
        timeout,
        delay: interval,
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

  public getAllSpaces(credentials: string, group?: string): Cypress.Chainable<Space[]> {
    return cy.kbnGet<Space[]>({
      endpoint: `api/spaces/space`,
      credentials,
      currentGroupHeader: group
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
