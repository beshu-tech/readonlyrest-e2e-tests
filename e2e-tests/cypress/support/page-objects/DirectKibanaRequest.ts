interface SavedObject {
  type: string;
  id: string;
}

interface DataView {
  id: string;
}

export interface GetObject {
  saved_objects: SavedObject[];
}

export interface GetReport {
  hits: {
    hits: { _id: string }[];
  };
}

export interface GetIndices {
  index: string;
}

export interface DataViews {
  data_view: DataView[];
}

export class DirectKibanaRequest {
  public static getObjectsUrl = (type = '&type=visualization&type=dashboard&type=config') =>
    `${Cypress.config().baseUrl}/api/saved_objects/_find?type=index-pattern&type=search&${type}`;

  public static deleteObjectUrl = (type, id) => `${Cypress.config().baseUrl}/api/saved_objects/${type}/${id}`;

  public static getIndices = `${Cypress.env().elasticsearchUrl}/_cat/indices?format=json`;

  public static getReportUrl = (reportingIndex: string) =>
    `${Cypress.env().elasticsearchUrl}/${reportingIndex}/_search`;

  public static deleteReportUrl = (reportingIndex: string, id: string) =>
    `${Cypress.env().elasticsearchUrl}/${reportingIndex}/_doc/${id}?refresh=wait_for`;

  public static deleteDataView = id => `${Cypress.config().baseUrl}/api/data_views/data_view/${id}`;

  static deleteSavedObjects = (user: string) => {
    cy.log(`Get all saved objects for the ${user}`);
    cy.getRequest({ url: DirectKibanaRequest.getObjectsUrl(), user }).then((result: GetObject) => {
      result.saved_objects.map(savedObject => {
        cy.log(`Remove ${savedObject.id} saved object for user1`);
        return cy.deleteRequest({
          url: DirectKibanaRequest.deleteObjectUrl(savedObject.type, savedObject.id),
          user
        });
      });
    });
  };

  static deleteDataViews = (user: string) => {
    cy.log(`get all data_views for the ${user}`);
    cy.getRequest({ url: `${Cypress.config().baseUrl}/api/data_views` }).then((result: DataViews) => {
      result.data_view.map(dataView => {
        cy.log(`Remove ${dataView.id} saved object for user1`);
        return cy.deleteRequest({
          url: DirectKibanaRequest.deleteDataView(dataView.id),
          user
        });
      });
    });
  };
}
