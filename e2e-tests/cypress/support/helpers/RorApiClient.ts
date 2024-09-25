export class RorApiClient {

  public configureRorIndexMainSettings(fixtureYamlFileName: string): void {
    cy.fixture(fixtureYamlFileName).then((yamlContent) => {
      cy.esPost({
        endpoint: "_readonlyrest/admin/config",
        credentials: Cypress.env().kibanaUserCredentials,
        payload: {
          settings: `${yamlContent}`
        }
      });
    });
  }

  public configureRorIndexTestSettings(fixtureYamlFileName: string): void {
    cy.fixture(fixtureYamlFileName).then((yamlContent) => {
      cy.esPost({
        endpoint: "_readonlyrest/admin/config/test",
        credentials: Cypress.env().kibanaUserCredentials,
        payload: {
          settings: `${yamlContent}`
        }
      });
    });
  }

  public configureRorAuthMockSettings(fixtureYamlFileName: string): void {
    cy.fixture(fixtureYamlFileName).then((yamlContent) => {
      cy.esPost({
        endpoint: "_readonlyrest/admin/config/test/authmock",
        credentials: Cypress.env().kibanaUserCredentials,
        payload: yamlContent
      });
    });
  }

}

export const rorApiClient = new RorApiClient();