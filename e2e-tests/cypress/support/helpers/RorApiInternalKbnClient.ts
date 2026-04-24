export class RorApiInternalKbnClient {
  public getLicense({
    impersonating,
    failOnStatusCode,
    credentials = Cypress.env().kibanaUserCredentials
  }: { impersonating?: string; failOnStatusCode?: boolean; credentials?: string } = {}): Cypress.Chainable<{
    status: string;
    statusCode: number;
    message: string;
  }> {
    return cy.kbnGet({
      endpoint: 'pkp/api/license',
      credentials,
      impersonating,
      failOnStatusCode
    });
  }

  public deactivateTestSettings({
    credentials = Cypress.env().kibanaUserCredentials
  }: { credentials?: string } = {}): Cypress.Chainable<void> {
    return cy.kbnDelete({
      endpoint: 'pkp/api/test',
      credentials
    });
  }

  public changeKibanaConfig(fixtureYamlFileName: string): Cypress.Chainable<void> {
    return cy.fixture(fixtureYamlFileName).then(yamlContent => {
      cy.kbnPost({
        endpoint: 'pkp/api/kibanaConfig',
        credentials: Cypress.env().kibanaUserCredentials,
        payload: `${yamlContent}`,
        headers: { 'Content-Type': 'application/yaml' }
      });
    });
  }
}

export const rorApiInternalKbnClient = new RorApiInternalKbnClient();
