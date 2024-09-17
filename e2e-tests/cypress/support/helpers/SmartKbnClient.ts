export class SmartKbnClient {

  static deleteSavedObjects = (userPass: string, group?: string) => {
    const requestOptions = group
      ? { url: SmartKbnClient.getObjectsUrl(), user: userPass, header: `x-ror-current-group: ${group}` }
      : { url: SmartKbnClient.getObjectsUrl(), user: userPass };

    cy.log(`Get all saved objects for the ${userPass}`);
    cy.getRequest(requestOptions)
      .then((result: GetObject) => {
        result.saved_objects.map(savedObject => {
          cy.log(`Remove ${savedObject.id} saved object for ${userPass}`);
          cy.deleteRequest({
            url: SmartKbnClient.deleteObjectUrl(savedObject.type, savedObject.id),
            user: userPass,
            ...(group && { header: `x-ror-current-group: ${group}` })
          })
        });
      }
      );
  };


  public static deleteDataView = id => `${Cypress.config().baseUrl}/api/data_views/data_view/${id}`;

  static deleteDataViews = (userPass: string) => {
    cy.log(`get all data_views for the ${userPass}`);
    cy.getRequest({ url: `${Cypress.config().baseUrl}/api/data_views` }).then((result: DataViews) => {
      result.data_view.map(dataView => {
        cy.log(`Remove ${dataView.id} saved object for ${userPass}`);
        return cy.deleteRequest({
          url: SmartKbnClient.deleteDataView(dataView.id),
          user: userPass
        });
      });
    });
  };

  public static getObjectsUrl = (type = '&type=visualization&type=dashboard&type=config') =>
    `${Cypress.config().baseUrl}/api/saved_objects/_find?type=index-pattern&type=search&${type}`;

  public static deleteObjectUrl = (type, id) =>
    `${Cypress.config().baseUrl}/api/saved_objects/${type}/${id}`;

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