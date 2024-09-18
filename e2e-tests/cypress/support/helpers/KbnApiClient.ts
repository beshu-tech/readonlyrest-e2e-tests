export class KbnApiClient {

  public getDataViews(credentials: string, group?: string): Cypress.Chainable<DataViews> {
    return cy.kbnGet({
      endpoint: "api/data_views",
      credentials: credentials,
      currentGroupHeader: group
    });
  }

  public createDataView(dataView: unknown, credentials: string, group?: string): void {
    cy.kbnPost({
      endpoint: "api/data_views/data_view",
      credentials: credentials,
      currentGroupHeader: group,
      payload: dataView
    });
  }

  public deleteDataView(dataViewId: string, credentials: string, group?: string): void {
    cy.kbnDelete({
      endpoint: `api/data_views/data_view/${dataViewId}`,
      credentials: credentials,
      currentGroupHeader: group
    });
  }

  public getSavedObjects(credentials: string, group?: string): Cypress.Chainable<GetObject> {
    return cy.kbnGet({
      endpoint: "api/saved_objects/_find?type=index-pattern&type=search&type=visualization&type=dashboard&type=config",
      credentials: credentials,
      currentGroupHeader: group
    });
  }

  public deleteSavedObject(savedObject: SavedObject, credentials: string, group?: string): void {
    cy.kbnDelete({
      endpoint: `api/saved_objects/${savedObject.type}/${savedObject.id}`,
      credentials: credentials,
      currentGroupHeader: group
    });
  }

  public deleteSampleData(sampleDatasetName: string, credentials: string, group?: string): void {
    cy.kbnDelete({
      endpoint: `api/sample_data/${sampleDatasetName}`,
      credentials: credentials,
      currentGroupHeader: group
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