import { kibanaCredentials } from './credentials';
import { isMultiKibanaNodeEnv } from './index';

// The node that answers this POST applies the new settings before it replies. Every other node
// picks them up from its own poll of the index, which runs every 5 s. Until then it still serves
// the old settings, so a login on one node is not recognized by the other and bounces to /login.
// The wait covers one poll interval with a margin. Only elk-ror needs it - it runs 2 kbn-ror
// replicas behind kbn-proxy's round robin, while eck-ror runs a single Kibana node.
// FIXME: See RORDEV-2235.
const SETTINGS_PROPAGATION_DELAY_MS = 8000;

export class RorApiClient {
  public configureRorIndexMainSettings(yamlContent: string): Cypress.Chainable<void> {
    return cy
      .kbnPost<{ status: string; message: string }>({
        endpoint: 'api/ror/settings?override=true',
        headers: {
          'Content-Type': 'application/yaml'
        },
        credentials: kibanaCredentials,
        payload: yamlContent
      })
      .then(response => {
        // The endpoint no-ops (status: FAILURE) when the posted content is already the active
        // config - e.g. two specs in a row both resetting to the same default fixture. That's
        // the desired state, not an error; only a genuinely different failure should throw.
        if (response.status === 'SUCCESS') {
          return isMultiKibanaNodeEnv() ? cy.wait(SETTINGS_PROPAGATION_DELAY_MS) : undefined;
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

  // Test settings stay active until their TTL ends, also after the spec that loaded them. Invalidating
  // settings that are not active also answers "OK".
  public invalidateTestSettings() {
    cy.esDelete<{ status: string; message: string }>({
      endpoint: '_readonlyrest/admin/config/test',
      credentials: kibanaCredentials
    }).then(result => {
      expect(result.status, `Test ACL invalidated: ${result.message}`).to.equal('OK');
    });
  }

  // ReadonlyREST answers a rejected Test ACL with HTTP 200 and status "FAILED", and keeps the
  // settings it had. Loading the settings that are already active is also a "FAILED".
  public configureRorIndexTestSettings(fixtureYamlFileName: string, ttlInSeconds: number): Cypress.Chainable<void> {
    return cy.fixture(fixtureYamlFileName).then(yamlContent => {
      cy.esPost<{ status: string; message: string }>({
        endpoint: '_readonlyrest/admin/config/test',
        credentials: kibanaCredentials,
        payload: {
          settings: `${yamlContent}`,
          ttl: `${ttlInSeconds} sec`
        }
      }).then(result => {
        const loaded = result.status === 'OK' || result.message === 'Current settings are already loaded';
        expect(loaded, `${fixtureYamlFileName} loaded as Test ACL: ${result.message}`).to.equal(true);
      });
    });
  }

  // ReadonlyREST answers a rejected auth mock with HTTP 200 and a status other than "OK", for
  // example when no Test ACL is active or the Test ACL does not use the mocked service.
  public configureRorAuthMockSettings(fixtureJsonFileName: string): Cypress.Chainable<void> {
    return cy.fixture(fixtureJsonFileName).then(content => {
      cy.esPost<{ status: string; message: string }>({
        endpoint: '_readonlyrest/admin/config/test/authmock',
        credentials: kibanaCredentials,
        payload: content
      }).then(result => {
        expect(result.status, `${fixtureJsonFileName} auth mock status: ${result.message}`).to.equal('OK');
      });
    });
  }

  // The main settings that ReadonlyREST keeps in its index, as YAML.
  public getRorIndexMainSettings(): Cypress.Chainable<string> {
    return cy
      .esGet<{ status: string; message: string }>({
        endpoint: '_readonlyrest/admin/config',
        credentials: kibanaCredentials
      })
      .then(response => {
        expect(response.status, `index settings status: ${response.message}`).to.equal('ok');
        return response.message;
      });
  }

  // Status is TEST_SETTINGS_PRESENT, TEST_SETTINGS_INVALIDATED or TEST_SETTINGS_NOT_CONFIGURED.
  public getRorTestSettingsStatus(): Cypress.Chainable<string> {
    return cy
      .esGet<{ status: string }>({
        endpoint: '_readonlyrest/admin/config/test',
        credentials: kibanaCredentials
      })
      .its('status');
  }
}

export const rorApiClient = new RorApiClient();
