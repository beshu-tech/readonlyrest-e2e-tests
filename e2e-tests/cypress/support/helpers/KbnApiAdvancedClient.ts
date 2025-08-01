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

  public waitForKibanaHealth(baseUrl: string, retries = 15, delay = 2000) {
    let attempts = 0;

    function poll() {
      return cy
        .task('checkKibanaHealth', {
          url: baseUrl
        })
        .then(status => {
          const kibana8xAndAboveSuccessStatus = status === 'available';
          const kibana7xSuccessStatus = status === 'green';

          if (kibana8xAndAboveSuccessStatus || kibana7xSuccessStatus) {
            cy.log('✅ Kibana is healthy');
            return;
          }

          if (attempts >= retries) {
            throw new Error(`❌ Kibana never became healthy (last status: ${status})`);
          }

          attempts += 1;
          return cy.wait(delay).then(poll);
        });
    }

    return poll();
  }
}

export const kbnApiAdvancedClient = new KbnApiAdvancedClient();
