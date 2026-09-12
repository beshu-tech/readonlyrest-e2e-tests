import { KbnApiClient } from './KbnApiClient';

// Every `credentials` here is a Basic pair, `user:password`. CI keeps its logs, so a message names
// the account and never the pair.
const accountOf = (credentials: string): string => credentials.split(':')[0];

const inTenancy = (group?: string): string => (group ? ` in ${group}` : '');

/**
 * The answer as the reader has to see it. A Kibana call that is logged out answers with a login
 * page, and `httpCall` hands that back as the page source, so the body is the evidence: cap it
 * instead of putting a whole HTML page in one error message.
 */
const describeBody = (data: unknown): string => {
  const shown = typeof data === 'string' ? data : JSON.stringify(data) ?? String(data);
  return shown.length > 2000 ? `${shown.slice(0, 2000)}…` : shown;
};

export class KbnApiAdvancedClient extends KbnApiClient {
  public deleteSavedObjects(credentials: string, group?: string): void {
    cy.log(`Get all saved objects for the ${credentials}`);
    this.getSavedObjects(credentials, group).then(result => {
      // This cleanup races the stack it cleans: under resetKibanaIndexToTemplate the tenancy
      // index can be mid-reset, and a session sweep or config restart can log the request out,
      // in which case the _find answers with a login page instead of the find JSON. An index
      // that is already resetting has nothing left to clean, so treat that as the empty list.
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
      // api/data_views answers { data_view: [...] }, and it answers 2xx with a login page when a
      // session sweep or a config restart logs the request out. The empty-list fallback that
      // deleteSavedObjects uses does not fit here: this cleanup races no index reset, so an answer
      // that is not the data_views JSON means the request failed, and an empty list would read that
      // as 'nothing to clean' and let the test pass. Say what came back instead.
      if (!Array.isArray(result?.data_view)) {
        throw new Error(
          `api/data_views did not answer with { data_view: [...] } for ${accountOf(credentials)}` +
            `${inTenancy(group)}. Body: ${describeBody(result)}`
        );
      }

      result.data_view.forEach(dataView => {
        cy.log(`Remove ${dataView.id} saved object for ${credentials}`);
        this.deleteDataView(dataView.id, credentials, group);
      });
    });
  }

  public deleteAllSpaces(credentials: string, group?: string): void {
    cy.log(`Delete all spaces`);
    this.getAllSpaces(credentials, group).then(spaces => {
      // Same logout race as deleteDataViews: api/spaces/space answers with the list of spaces, and
      // answers 2xx with a login page once the request is no longer authenticated.
      if (!Array.isArray(spaces)) {
        throw new Error(
          `api/spaces/space did not answer with a list of spaces for ${accountOf(credentials)}` +
            `${inTenancy(group)}. Body: ${describeBody(spaces)}`
        );
      }

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
          return cy.wrap(undefined);
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
            return cy.wrap(undefined);
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
