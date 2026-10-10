import { recurse } from 'cypress-recurse';
import { BasicCredentials, KbnApiClient, SavedObject, Space } from './KbnApiClient';
import { requiredBaseUrl } from './index';

export class KbnApiAdvancedClient extends KbnApiClient {
  public deleteSavedObjects(credentials: string, group?: string): void {
    cy.log(`Get all saved objects for the ${credentials}`);
    this.findAllSavedObjects(credentials, group).then(savedObjects => {
      savedObjects.forEach(savedObject => {
        cy.log(`Remove ${savedObject.id} saved object for ${credentials}`);
        // Best effort: an object listed a moment ago can already be gone (404). Losing that
        // race must not fail cleanup.
        this.deleteSavedObject(savedObject, credentials, group, { failOnStatusCode: false });
      });
    });
  }

  // _find gives one page of results, so this reads page after page until it has them all. The
  // deletes come after the last page: a delete between two pages moves objects to earlier pages.
  private findAllSavedObjects(
    credentials: string,
    group?: string,
    page = 1,
    found: SavedObject[] = []
  ): Cypress.Chainable<SavedObject[]> {
    return this.getSavedObjects(credentials, group, { page, perPage: 100 }).then(result => {
      // This cleanup races the stack it cleans: under resetKibanaIndexToTemplate the tenancy
      // index can be mid-reset, and a session sweep or config restart can log the request out,
      // in which case the _find answers with a login page instead of the find JSON. An index
      // that is already resetting has nothing left to clean, so treat that as the end of the list.
      const pageObjects = result?.saved_objects ?? [];
      const all = [...found, ...pageObjects];
      if (pageObjects.length === 0 || all.length >= (result.total ?? 0)) {
        return cy.wrap(all, { log: false });
      }
      return this.findAllSavedObjects(credentials, group, page + 1, all);
    });
  }

  public deleteDataViews(credentials: BasicCredentials, group?: string) {
    cy.log(`get all data_views for the ${credentials}`);
    this.getDataViews(credentials, group).then(result => {
      result.data_view.forEach(dataView => {
        cy.log(`Remove ${dataView.id} saved object for ${credentials}`);
        this.deleteDataView(dataView.id, credentials, group);
      });
    });
  }

  /**
   * Deletes every space but the default one, and makes every feature of the default space visible.
   * A request can fail for a short time, for example with a 403 while ROR reloads its settings. So
   * each request is best effort, and the check of the result repeats them until it passes.
   */
  public resetSpaces(credentials: BasicCredentials, group?: string): void {
    cy.log(`Reset spaces${group ? ` in ${group}` : ''}`);
    recurse(
      () => {
        this.tryResetSpaces(credentials, group);
        return this.findSpaces(credentials, group);
      },
      spaces =>
        spaces !== undefined && spaces.every(space => space.id === 'default' && space.disabledFeatures.length === 0),
      {
        delay: 1000,
        timeout: 30000,
        log: false,
        error: `Spaces did not reset${group ? ` in ${group}` : ''}`
      }
    );
  }

  /** One pass of resetSpaces that does not fail the test. Use it where a failure must not stop the rest of a hook. */
  public tryResetSpaces(credentials: BasicCredentials, group?: string): void {
    this.findSpaces(credentials, group).then(spaces => {
      (spaces ?? []).forEach(space => {
        if (space.id !== 'default') {
          this.deleteSpace(space.id, credentials, group, { failOnStatusCode: false });
        } else if (space.disabledFeatures.length > 0) {
          this.updateSpace(defaultSpaceWithAllFeatures(space), credentials, group, { failOnStatusCode: false });
        }
      });
    });
  }

  /**
   * Deletes the search sessions that the account can see in its tenancy. A search session is a saved
   * object of a hidden type, so the saved objects API does not list it. The search session API does.
   */
  public deleteSearchSessions(credentials: BasicCredentials, group?: string): void {
    cy.log(`Delete search sessions${group ? ` in ${group}` : ''}`);
    recurse(
      () =>
        this.findSearchSessionIds(credentials, group).then(ids => {
          (ids ?? []).forEach(id => {
            cy.kbnDelete({
              endpoint: `internal/session/${id}`,
              credentials,
              currentGroupHeader: group,
              headers: SEARCH_SESSION_API_HEADERS,
              failOnStatusCode: false
            });
          });
          return cy.wrap(ids, { log: false });
        }),
      ids => ids !== undefined && ids.length === 0,
      {
        delay: 1000,
        timeout: 30000,
        log: false,
        error: `Search sessions were not deleted${group ? ` in ${group}` : ''}`
      }
    );
  }

  // Yields undefined when the answer is not the JSON of a search session list.
  private findSearchSessionIds(credentials: BasicCredentials, group?: string): Cypress.Chainable<string[] | undefined> {
    return cy
      .kbnPost({
        endpoint: 'internal/session/_find',
        credentials,
        currentGroupHeader: group,
        headers: SEARCH_SESSION_API_HEADERS,
        payload: { page: 1, perPage: 100 },
        failOnStatusCode: false
      })
      .then(body => {
        // A logged-out request gets the login page, a string.
        const sessions = (body as { saved_objects?: Array<{ id: string }> } | undefined)?.saved_objects;
        return cy.wrap(Array.isArray(sessions) ? sessions.map(session => session.id) : undefined, { log: false });
      });
  }

  // Yields undefined when the answer is not a list of spaces: an error status, or the login page.
  private findSpaces(credentials: BasicCredentials, group?: string): Cypress.Chainable<Space[] | undefined> {
    return cy
      .kbnGet<unknown>({
        endpoint: 'api/spaces/space',
        credentials,
        currentGroupHeader: group,
        failOnStatusCode: false
      })
      .then(body => cy.wrap(Array.isArray(body) ? (body as Space[]) : undefined, { log: false }));
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

  /**
   * Waits until Kibana answers a request that ReadonlyREST authenticates. waitForKibanaHealth is not
   * enough: /api/status answers also on a Kibana node whose ReadonlyREST part never answers a user
   * request (RORDEV-2283). Such a node does not recover until it restarts, so the wait stays short.
   *
   * The wait finds a node that gives no answer within the request timeout. Behind the docker proxy
   * the requests go to the replicas in turn, and the proxy waits longer than this timeout for an
   * answer. The proxy sends a failed GET (refused, 502, 503 or 504) to the other replica, so the
   * wait does not see a replica that fails in that way.
   */
  public waitForKibanaToAnswerUserRequests() {
    const requestTimeoutMs = 10000;
    const totalTimeoutMs = 45000;

    return cy.task(
      'waitForKibanaToAnswer',
      {
        url: `${requiredBaseUrl()}/api/spaces/space`,
        headers: {
          authorization: `Basic ${btoa(`${Cypress.env('login')}:${Cypress.env('password')}`)}`,
          'kbn-xsrf': 'true'
        },
        answersInARow: 4,
        requestTimeoutMs,
        totalTimeoutMs
      },
      { timeout: totalTimeoutMs + requestTimeoutMs }
    );
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

// Kibana 8 and later version the search session API. Kibana 7 ignores the header.
const SEARCH_SESSION_API_HEADERS = { 'elastic-api-version': '1' };

// PUT replaces the whole space and rejects unknown fields, so this sends only the fields it knows.
const defaultSpaceWithAllFeatures = ({
  id,
  name,
  description,
  color,
  initials,
  imageUrl,
  solution,
  _reserved
}: Space) => ({
  id,
  name,
  description,
  color,
  initials,
  imageUrl,
  solution,
  _reserved,
  disabledFeatures: []
});

export const kbnApiAdvancedClient = new KbnApiAdvancedClient();
