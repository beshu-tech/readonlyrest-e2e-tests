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
        if (response.status !== 'SUCCESS' && response.message !== 'Current settings are already loaded') {
          throw new Error(`Failed to configure ROR index main settings: ${JSON.stringify(response)}`);
        }
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
