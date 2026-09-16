import { BasicCredentials, KbnApiClient } from './KbnApiClient';
import type { KibanaHealth } from '../types';

/**
 * Whether one probe proves that the replica it reached serves, and that no other replica turned the
 * probe away.
 *
 * Kibana 8.x and later answer 'available'; 7.x answers 'green'. The proxy tries one replica per
 * request and moves to the next when that one does not answer, so a probe that names two replicas
 * has already found one of them down.
 */
const probeServed = ({ status, replicasTried }: KibanaHealth) =>
  (status === 'available' || status === 'green') && replicasTried.length === 1;

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

  public deleteDataViews(credentials: BasicCredentials, group?: string) {
    cy.log(`get all data_views for the ${credentials}`);
    this.getDataViews(credentials, group).then(result => {
      result.data_view.forEach(dataView => {
        cy.log(`Remove ${dataView.id} saved object for ${credentials}`);
        this.deleteDataView(dataView.id, credentials, group);
      });
    });
  }

  public deleteAllSpaces(credentials: BasicCredentials, group?: string): void {
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

    const waitUntilDown = (): Cypress.Chainable<undefined> =>
      cy.task<KibanaHealth>('checkKibanaHealth', { url: baseUrl }).then((health): Cypress.Chainable<undefined> => {
        if (!probeServed(health)) {
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
   * Waits until every Kibana replica serves, not just the one a probe happened to reach.
   *
   * The docker environment runs two Kibana replicas behind a round-robin proxy, so one healthy
   * answer proves nothing about the other replica. A test that carries on after a single healthy
   * answer sends half its requests to a replica that is still starting, which has no session yet
   * and bounces the browser back to the login page.
   *
   * Round-robin gives each replica one request in turn, so a run of probes that each reached their
   * replica first try, one longer than the number of replicas seen, covers them all. A probe that
   * failed over, or that came back unhealthy, starts the run again.
   */
  public waitForKibanaHealth(baseUrl: string, retries = 15, delay = 2000) {
    let attempts = 0;
    let servedInARow = 0;
    const replicas = new Set<string>();

    function poll(): Cypress.Chainable<undefined> {
      return cy
        .task<KibanaHealth>('checkKibanaHealth', {
          url: baseUrl
        })
        .then((health): Cypress.Chainable<undefined> => {
          health.replicasTried.forEach(replica => replicas.add(replica));
          servedInARow = probeServed(health) ? servedInARow + 1 : 0;

          if (servedInARow > replicas.size) {
            cy.log(`✅ Kibana is healthy on all ${replicas.size} replica(s)`);
            return cy.wrap(undefined);
          }

          if (attempts >= retries) {
            throw new Error(
              `❌ Kibana never became healthy on all ${replicas.size} replica(s) ` +
                `(last status: ${health.status} from ${health.replicasTried.join(' then ')})`
            );
          }

          attempts += 1;
          return cy.wait(delay).then(poll);
        });
    }

    return poll();
  }
}

export const kbnApiAdvancedClient = new KbnApiAdvancedClient();
