export class SmartKbnClient {

  static deleteSavedObjects = (userPass: string, group?: string) => {
    cy.log(`Get all saved objects for the ${userPass}`);
    cy.kbnGet({ endpoint: SmartKbnClient.getObjectEndpoint(), credentials: userPass, currentGroupHeader: group })
      .then((result: GetObject) => {
        result.saved_objects.map(savedObject => {
          cy.log(`Remove ${savedObject.id} saved object for ${userPass}`);
          cy.kbnDelete({
            endpoint: SmartKbnClient.deleteObjectEndpoint(savedObject.type, savedObject.id),
            credentials: userPass,
            currentGroupHeader: group
          });
        });
      });
  };

  static deleteDataViews = (userPass: string) => {
    cy.log(`get all data_views for the ${userPass}`);
    cy.kbnGet({ endpoint: "api/data_views", credentials: userPass }).then((result: DataViews) => {
      result.data_view.map(dataView => {
        cy.log(`Remove ${dataView.id} saved object for ${userPass}`);
        return cy.kbnDelete({
          endpoint: SmartKbnClient.deleteDataViewEndpoint(dataView.id),
          credentials: userPass
        });
      });
    });
  };

  public static deleteDataViewEndpoint = id => `api/data_views/data_view/${id}`;

  public static getObjectEndpoint = (type = '&type=visualization&type=dashboard&type=config') =>
    `api/saved_objects/_find?type=index-pattern&type=search&${type}`;

  public static deleteObjectEndpoint = (type, id) =>
    `api/saved_objects/${type}/${id}`;

}

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