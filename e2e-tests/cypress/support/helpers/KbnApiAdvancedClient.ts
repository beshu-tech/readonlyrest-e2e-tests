import { KbnApiClient } from './KbnApiClient';

export class KbnApiAdvancedClient extends KbnApiClient {
  public deleteSavedObjects(credentials: string, group?: string): void {
    cy.log(`Get all saved objects for the ${credentials}`);
    this.getSavedObjects(credentials, group).then(result => {
      result.saved_objects.map(savedObject => {
        cy.log(`Remove ${savedObject.id} saved object for ${credentials}`);
        this.deleteSavedObject(savedObject, credentials, group);
      });
    });
  }

  public deleteDataViews(credentials: string, group?: string) {
    cy.log(`get all data_views for the ${credentials}`);
    this.getDataViews(credentials, group).then(result => {
      result.data_view.forEach(dataView => {
        cy.log(`Remove ${dataView.id} saved object for ${credentials}`);
        this.deleteDataView(dataView.id, credentials, group);
      });
    });
  }

  public deleteAllSpaces(credentials: string): void {
    cy.log(`Delete all spaces`);
    this.getAllSpaces(credentials).then(spaces => {
      spaces
        .filter(space => space.id !== 'default')
        .forEach(space => {
          this.deleteSpace(space.id, credentials);
        });
    });
  }
}

export const kbnApiAdvancedClient = new KbnApiAdvancedClient();
