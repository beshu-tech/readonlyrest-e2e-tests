import { kbnApiAdvancedClient } from './KbnApiAdvancedClient';
import { requiredBaseUrl } from './index';

// A Kibana restart on a CI runner outlasts the 180s the compose healthcheck grants a cold boot.
const RESTART_RETRIES = 150;
const RESTART_DELAY_MS = 2000;

export class RorApiClient {
  /**
   * Writes the main settings, then waits for every Kibana replica to serve again.
   *
   * ReadonlyREST restarts Kibana when these settings change what Kibana itself runs on. The write
   * answers before the restart finishes, so a test that carries straight on sends its next request
   * to a replica that is on its way down, or to one that is back up without a session. Waiting here
   * costs a few seconds per call and removes both races.
   */
  public configureRorIndexMainSettings(fixtureYamlFileName: string): Cypress.Chainable<void> {
    return cy
      .fixture(fixtureYamlFileName)
      .then(yamlContent => {
        cy.esPost({
          endpoint: '_readonlyrest/admin/config',
          credentials: Cypress.env().kibanaUserCredentials,
          payload: {
            settings: `${yamlContent}`
          }
        });
      })
      .then(() => kbnApiAdvancedClient.waitForKibanaHealth(requiredBaseUrl(), RESTART_RETRIES, RESTART_DELAY_MS));
  }

  public configureRorIndexTestSettings(fixtureYamlFileName: string, ttlInSeconds: number): Cypress.Chainable<void> {
    return cy.fixture(fixtureYamlFileName).then(yamlContent => {
      cy.esPost({
        endpoint: '_readonlyrest/admin/config/test',
        credentials: Cypress.env().kibanaUserCredentials,
        payload: {
          settings: `${yamlContent}`,
          ttl: `${ttlInSeconds} sec`
        }
      });
    });
  }

  public configureRorAuthMockSettings(fixtureJsonFileName: string): Cypress.Chainable<void> {
    return cy.fixture(fixtureJsonFileName).then(content => {
      cy.esPost({
        endpoint: '_readonlyrest/admin/config/test/authmock',
        credentials: Cypress.env().kibanaUserCredentials,
        payload: content
      });
    });
  }
}

export const rorApiClient = new RorApiClient();
