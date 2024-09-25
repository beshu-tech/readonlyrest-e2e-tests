export class RorApiClient {

  public configureRorIndexSettings(fixtureYamlFileName: string): void {
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
}

export const rorApiClient = new RorApiClient();