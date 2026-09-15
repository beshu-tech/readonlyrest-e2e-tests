// The ROR Kibana plugin picks up a new index-stored config asynchronously - each kbn-ror node
// only refreshes its in-memory settings when its own cache goes stale, not the instant the POST
// below returns. Proceeding immediately (e.g. straight into Login.initialization()) races that
// refresh: observed lag between a successful POST and the new config being active was up to ~10s.
// See run-20260831-073804-1.log for the flaky "should disable multitenancy" / "should verify index
// based session" failures this caused.
//
// A re-POST-and-check-for-idempotency poll was tried here instead of a flat sleep, but the
// idempotency check compares against the config already persisted in the ES index - which the
// first POST writes immediately - not against any single node's in-memory cache. Against the
// docker env's 2 kbn-ror replicas behind kbn-proxy's round robin, that made the "poll" resolve
// after its very first iteration (~1s) regardless of whether either replica had actually
// refreshed, which was worse than the flat delay it replaced. See run-34312427155 for the
// resulting "should verify index based session" / Hide_apps / Sanity-check flakiness.
const SETTINGS_PROPAGATION_DELAY_MS = 8000;

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
          return cy.wait(SETTINGS_PROPAGATION_DELAY_MS);
        }
        if (response.message !== 'Current settings are already loaded') {
          throw new Error(`Failed to configure ROR index main settings: ${JSON.stringify(response)}`);
        }
        return undefined;
      })
      .then(() => undefined);
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
