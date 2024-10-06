export class RorApiClient {
  public configureRorIndexMainSettings(fixtureYamlFileName: string): Cypress.Chainable<void> {
    return cy.fixture(fixtureYamlFileName).then(yamlContent => {
      cy.esPost({
        endpoint: '_readonlyrest/admin/config',
        credentials: Cypress.env().kibanaUserCredentials,
        payload: {
          settings: `${yamlContent}`
        }
      });
    });
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
