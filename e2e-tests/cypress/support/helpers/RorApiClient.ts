// The ROR Kibana plugin picks up a new index-stored config asynchronously - each kbn-ror node
// only refreshes its in-memory settings when its own cache goes stale, not the instant the POST
// below returns. Proceeding immediately (e.g. straight into Login.initialization()) races that
// refresh: observed lag between a successful POST and the new config being active was up to ~10s.
// See run-20260831-073804-1.log for the flaky "should disable multitenancy" / "should verify index
// based session" failures this caused.
//
// Rather than blindly sleeping a fixed delay (too short under load, wastefully long otherwise),
// re-POST the same content and rely on the endpoint's own idempotency check: once the node has
// actually picked up the new config, re-posting it answers "Current settings are already loaded"
// instead of SUCCESS. That's the readiness signal we poll for.
const SETTINGS_PROPAGATION_POLL_INTERVAL_MS = 1000;
const SETTINGS_PROPAGATION_POLL_TIMEOUT_MS = 15000;

export class RorApiClient {
  public configureRorIndexMainSettings(yamlContent: string): Cypress.Chainable<void> {
    return cy
      .kbnPost<{ status: string; message: string }>({
        endpoint: 'api/ror/settings?override=true',
        headers: {
          'Content-Type': 'application/yaml'
        },
        credentials: Cypress.env().kibanaUserCredentials,
        payload: yamlContent
      })
      .then(response => {
        // The endpoint no-ops (status: FAILURE) when the posted content is already the active
        // config - e.g. two specs in a row both resetting to the same default fixture. That's
        // the desired state, not an error; only a genuinely different failure should throw.
        if (response.status === 'SUCCESS') {
          return this.waitForSettingsPropagation(yamlContent);
        }
        if (response.message !== 'Current settings are already loaded') {
          throw new Error(`Failed to configure ROR index main settings: ${JSON.stringify(response)}`);
        }
        return undefined;
      })
      .then(() => undefined);
  }

  private waitForSettingsPropagation(yamlContent: string, elapsedMs = 0): Cypress.Chainable<void> {
    return cy
      .wait(SETTINGS_PROPAGATION_POLL_INTERVAL_MS)
      .kbnPost<{ status: string; message: string }>({
        endpoint: 'api/ror/settings?override=true',
        headers: {
          'Content-Type': 'application/yaml'
        },
        credentials: Cypress.env().kibanaUserCredentials,
        payload: yamlContent
      })
      .then(response => {
        if (response.message === 'Current settings are already loaded') {
          return undefined;
        }

        const nextElapsedMs = elapsedMs + SETTINGS_PROPAGATION_POLL_INTERVAL_MS;
        if (nextElapsedMs >= SETTINGS_PROPAGATION_POLL_TIMEOUT_MS) {
          throw new Error(
            `Timed out after ${SETTINGS_PROPAGATION_POLL_TIMEOUT_MS}ms waiting for ROR index main settings to propagate`
          );
        }

        return this.waitForSettingsPropagation(yamlContent, nextElapsedMs);
      });
  }

  public configureRorIndexMainSettingsFromFixture(fixtureYamlFileName: string): Cypress.Chainable<void> {
    return cy.fixture(fixtureYamlFileName).then(yaml => this.configureRorIndexMainSettings(yaml));
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
