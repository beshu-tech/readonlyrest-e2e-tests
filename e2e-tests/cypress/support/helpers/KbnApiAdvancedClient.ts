import { KbnApiClient } from './KbnApiClient';

export class KbnApiAdvancedClient extends KbnApiClient {
  public deleteSavedObjects(credentials: string, group?: string): void {
    cy.log(`Get all saved objects for the ${credentials}`);
    this.getSavedObjects(credentials, group, { failOnStatusCode: false }).then(result => {
      // This cleanup races the stack it cleans: under resetKibanaIndexToTemplate the tenancy
      // index can be mid-reset, and a session sweep or config restart can log the request out,
      // in which case the _find answers with a login page instead of the find JSON (or, if the
      // ACL evaluates the mid-reset tenancy index as inaccessible, a 403). An index that is
      // already resetting has nothing left to clean, so treat any of that as the empty list.
      (result?.saved_objects ?? []).forEach(savedObject => {
        cy.log(`Remove ${savedObject.id} saved object for ${credentials}`);
        // Best effort: an object listed a moment ago can already be gone (404). Losing that
        // race must not fail cleanup.
        this.deleteSavedObject(savedObject, credentials, group, { failOnStatusCode: false });
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

  public deleteAllSpaces(credentials: string, group?: string): void {
    cy.log(`Delete all spaces`);
    this.getAllSpaces(credentials, group).then(spaces => {
      spaces
        .filter(space => space.id !== 'default')
        .forEach(space => {
          this.deleteSpace(space.id, credentials, group);
        });
    });
  }

  /**
   * Waits out a restart that is known to be under way: watches Kibana go away first, then serve
   * again. Only call this when the config really did change — see changeKibanaConfig, which asks the
   * endpoint. Never seeing Kibana go down is a failure here, deliberately: treating it as 'then no
   * restart was needed' would put back exactly the race described above whenever a shutdown ran
   * slower than the wait.
   */
  public waitForKibanaRestart(baseUrl: string, downRetries = 120, delay = 1000) {
    let attempts = 0;

    const isServing = (status: string) => status === 'available' || status === 'green';

    const waitUntilDown = (): Cypress.Chainable<undefined> =>
      cy.task<string>('checkKibanaHealth', { url: baseUrl }).then((status): Cypress.Chainable<undefined> => {
        if (!isServing(status)) {
          cy.log('⏳ Kibana went down, waiting for it to come back');
          return cy.then(() => undefined);
        }

        if (attempts >= downRetries) {
          throw new Error(
            `Kibana was still serving ${downRetries * delay}ms after a config change that restarts it. ` +
              'It never went down, so there is no safe point to carry on from.'
          );
        }

        attempts += 1;
        return cy.wait(delay).then(waitUntilDown);
      });

    return waitUntilDown().then(() => this.waitForKibanaHealth(baseUrl, 90, 2000));
  }

  public waitForKibanaHealth(baseUrl: string, retries = 15, delay = 2000) {
    let attempts = 0;

    function poll(): Cypress.Chainable<undefined> {
      return cy
        .task<string>('checkKibanaHealth', {
          url: baseUrl
        })
        .then((status): Cypress.Chainable<undefined> => {
          const kibana8xAndAboveSuccessStatus = status === 'available';
          const kibana7xSuccessStatus = status === 'green';

          if (kibana8xAndAboveSuccessStatus || kibana7xSuccessStatus) {
            cy.log('✅ Kibana is healthy');
            return cy.then(() => undefined);
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
