import { accountOf, BasicCredentials } from './credentials';

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
    cy.kbnPost<{ data_view?: DataView }>({
      endpoint: 'api/data_views/data_view',
      credentials,
      currentGroupHeader: group,
      payload: dataView
    }).then(result => {
      // A request that Kibana has logged out gets a 2xx login page instead of the JSON.
      if (typeof result?.data_view?.id !== 'string') {
        throw new Error(
          `api/data_views/data_view did not answer with the new data view for ${accountOf(credentials)}` +
            `${inTenancy(group)}. Body: ${describeBody(result)}`
        );
      }
    });
  }

  public deleteDataView(
    dataViewId: string,
    credentials: string,
    group?: string,
    { failOnStatusCode = true }: { failOnStatusCode?: boolean } = {}
  ): void {
    cy.kbnDelete({
      endpoint: `api/data_views/data_view/${dataViewId}`,
      credentials,
      currentGroupHeader: group,
      failOnStatusCode
    });
  }

  public getSavedObjects(
    credentials: string,
    group?: string,
    { page = 1, perPage = 20 }: { page?: number; perPage?: number } = {}
  ): Cypress.Chainable<GetObject> {
    return cy.kbnGet<GetObject>({
      endpoint:
        'api/saved_objects/_find?type=index-pattern&type=search&type=visualization&type=dashboard&type=url' +
        `&page=${page}&per_page=${perPage}`,
      credentials,
      currentGroupHeader: group
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

  public loadSampleData(sampleDatasetName: string, credentials: string, group?: string): void {
    cy.kbnPost<{ elasticsearchIndicesCreated?: Record<string, number> }>({
      endpoint: `api/sample_data/${sampleDatasetName}`,
      credentials,
      currentGroupHeader: group
    }).then(result => {
      // A request that Kibana has logged out gets a 2xx login page instead of the JSON.
      if (typeof result?.elasticsearchIndicesCreated !== 'object') {
        throw new Error(
          `api/sample_data/${sampleDatasetName} did not answer with the created indices for ${accountOf(credentials)}` +
            `${inTenancy(group)}. Body: ${describeBody(result)}`
        );
      }
    });
  }

  public deleteSampleData(sampleDatasetName: string, credentials: string, group?: string): void {
    cy.kbnDelete({
      endpoint: `api/sample_data/${sampleDatasetName}`,
      credentials,
      currentGroupHeader: group
    });
  }

  public deleteSpace(
    spaceId: string,
    credentials: string,
    group?: string,
    { failOnStatusCode = true }: { failOnStatusCode?: boolean } = {}
  ): void {
    cy.kbnDelete({
      endpoint: `api/spaces/space/${spaceId}`,
      credentials,
      currentGroupHeader: group,
      failOnStatusCode
    });
  }

  public updateSpace(
    space: Space,
    credentials: string,
    group?: string,
    { failOnStatusCode = true }: { failOnStatusCode?: boolean } = {}
  ): void {
    cy.kbnPut({
      endpoint: `api/spaces/space/${space.id}`,
      credentials,
      currentGroupHeader: group,
      payload: space,
      failOnStatusCode
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

export interface SavedObject {
  type: string;
  id: string;
}

export interface GetObject {
  saved_objects: SavedObject[];
  total: number;
}

export interface Space {
  id: string;
  name: string;
  description?: string;
  initials?: string;
  color?: string;
  disabledFeatures: string[];
  imageUrl?: string;
  solution?: string;
  _reserved?: boolean;
}

export interface ShortUrlPayload {
  locatorId: string;
  params: Record<string, unknown>;
}

export interface ShortUrlResponse {
  id: string;
}

const inTenancy = (group?: string): string => (group ? ` in ${group}` : '');

export const describeBody = (data: unknown): string => {
  const shown = typeof data === 'string' ? data : JSON.stringify(data) ?? String(data);
  return shown.length > 2000 ? `${shown.slice(0, 2000)}…` : shown;
};
