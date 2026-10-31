import { recurse } from 'cypress-recurse';
import { accountOf, BasicCredentials } from './credentials';

const isSuccess = (status: number) => status >= 200 && status < 300;

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

  public createDataView(dataView: object, credentials: BasicCredentials, group?: string): void {
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

  public deleteDataView(dataViewId: string, credentials: BasicCredentials, group?: string): void {
    cy.kbnDelete({ endpoint: `api/data_views/data_view/${dataViewId}`, credentials, currentGroupHeader: group });
  }

  public deleteDataViewIfPresent(dataViewId: string, credentials: BasicCredentials, group?: string): void {
    this.deleteIfPresent({
      endpoint: `api/data_views/data_view/${dataViewId}`,
      credentials,
      currentGroupHeader: group
    });
  }

  protected static savedObjectsFindEndpoint(page = 1, perPage = 20) {
    return (
      'api/saved_objects/_find?type=index-pattern&type=search&type=visualization&type=dashboard&type=url&type=tag' +
      `&page=${page}&per_page=${perPage}`
    );
  }

  public getSavedObjects(
    credentials: BasicCredentials,
    group?: string,
    { page = 1, perPage = 20 }: { page?: number; perPage?: number } = {}
  ): Cypress.Chainable<GetObject> {
    return cy.kbnGet<GetObject>({
      endpoint: KbnApiClient.savedObjectsFindEndpoint(page, perPage),
      credentials,
      currentGroupHeader: group
    });
  }

  public deleteSavedObject(savedObject: SavedObject, credentials: BasicCredentials, group?: string): void {
    cy.kbnDelete({
      endpoint: `api/saved_objects/${savedObject.type}/${savedObject.id}`,
      credentials,
      currentGroupHeader: group
    });
  }

  public deleteSavedObjectIfPresent(savedObject: SavedObject, credentials: BasicCredentials, group?: string): void {
    this.deleteIfPresent({
      endpoint: `api/saved_objects/${savedObject.type}/${savedObject.id}`,
      credentials,
      currentGroupHeader: group
    });
  }

  public loadSampleData(sampleDatasetName: string, credentials: BasicCredentials, group?: string): void {
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

  public deleteSampleData(sampleDatasetName: string, credentials: BasicCredentials, group?: string): void {
    cy.kbnDelete({
      endpoint: `api/sample_data/${sampleDatasetName}`,
      credentials,
      currentGroupHeader: group
    });
  }

  // For a cleanup delete: the object can already be gone, so a 404 also counts as done.
  protected deleteIfPresent(options: Omit<Cypress.ResponseOptions<Cypress.KbnRequestOptions>, 'method'>): void {
    cy.kbnResponse({ ...options, method: 'DELETE' })
      .its('status')
      .then(status => {
        expect(status, `status of DELETE ${options.endpoint}`).to.satisfy((s: number) => isSuccess(s) || s === 404);
      });
  }

  // For a cleanup request that must take effect: sends it until isDone accepts the status (2xx by
  // default), for at most about 10 s, and fails with the last status after that.
  protected repeatUntilSuccess(
    options: Cypress.ResponseOptions<Cypress.KbnRequestOptions>,
    isDone: (status: number) => boolean = isSuccess
  ): void {
    recurse(() => cy.kbnResponse(options).its('status'), isDone, { limit: 10, delay: 1000, log: false });
  }

  public deleteSpace(
    spaceId: string,
    credentials: BasicCredentials,
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
    credentials: BasicCredentials,
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
    credentials: BasicCredentials,
    group?: string
  ): Cypress.Chainable<ShortUrlResponse> {
    return cy.kbnPost<ShortUrlResponse>({
      endpoint: 's/default/api/short_url',
      credentials,
      currentGroupHeader: group,
      payload
    });
  }

  public createShortUrlLegacy(credentials: BasicCredentials, group?: string): Cypress.Chainable<ShortUrlResponse> {
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
