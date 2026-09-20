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
        credentials: Cypress.env().kibanaUserCredentials,
        payload: yamlContent
      })
      .then(response => {
        // The endpoint no-ops (status: FAILURE) when the posted content is already the active
        // config - e.g. two specs in a row both resetting to the same default fixture. That's
        // the desired state, not an error; only a genuinely different failure should throw.
        if (response.status === 'SUCCESS') {
          return Cypress.env().envName === 'elk-ror' ? cy.wait(SETTINGS_PROPAGATION_DELAY_MS) : undefined;
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
