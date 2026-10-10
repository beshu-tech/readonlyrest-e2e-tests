export class RorApiClient {
  public configureRorIndexMainSettings(fixtureYamlFileName: string): Cypress.Chainable<void> {
    return cy.fixture(fixtureYamlFileName).then(yamlContent => {
      cy.esPost({
        endpoint: '_readonlyrest/admin/config',
        credentials: Cypress.env().kibanaUserCredentials,
        payload: {
          settings: `${yamlContent}`
        }
      }).then(response => {
        // ReadonlyREST answers a rejected config with HTTP 200 and status "ko", and keeps the
        // settings it had. Loading the settings that are already active is also a "ko".
        const result = response as unknown as { status: string; message: string };
        const loaded = result.status === 'ok' || result.message === 'Current settings are already loaded';
        expect(loaded, `${fixtureYamlFileName} loaded: ${result.message}`).to.equal(true);
      });
    });
  }

  // ReadonlyREST answers a rejected Test ACL with HTTP 200 and status "FAILED", and keeps the
  // settings it had. Loading the settings that are already active is also a "FAILED".
  public configureRorIndexTestSettings(fixtureYamlFileName: string, ttlInSeconds: number): Cypress.Chainable<void> {
    return cy.fixture(fixtureYamlFileName).then(yamlContent => {
      cy.esPost({
        endpoint: '_readonlyrest/admin/config/test',
        credentials: Cypress.env().kibanaUserCredentials,
        payload: {
          settings: `${yamlContent}`,
          ttl: `${ttlInSeconds} sec`
        }
      }).then(response => {
        const result = response as unknown as { status: string; message: string };
        const loaded = result.status === 'OK' || result.message === 'Current settings are already loaded';
        expect(loaded, `${fixtureYamlFileName} loaded as Test ACL: ${result.message}`).to.equal(true);
      });
    });
  }

  // ReadonlyREST answers a rejected auth mock with HTTP 200 and a status other than "OK", for
  // example when no Test ACL is active or the Test ACL does not use the mocked service.
  public configureRorAuthMockSettings(fixtureJsonFileName: string): Cypress.Chainable<void> {
    return cy.fixture(fixtureJsonFileName).then(content => {
      cy.esPost({
        endpoint: '_readonlyrest/admin/config/test/authmock',
        credentials: Cypress.env().kibanaUserCredentials,
        payload: content
      }).then(response => {
        const result = response as unknown as { status: string; message: string };
        expect(result.status, `${fixtureJsonFileName} auth mock status: ${result.message}`).to.equal('OK');
      });
    });
  }

  // The main settings that ReadonlyREST keeps in its index, as YAML.
  public getRorIndexMainSettings(): Cypress.Chainable<string> {
    return cy
      .esGet<{ status: string; message: string }>({
        endpoint: '_readonlyrest/admin/config',
        credentials: Cypress.env().kibanaUserCredentials
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
        credentials: Cypress.env().kibanaUserCredentials
      })
      .its('status');
  }
}

export const rorApiClient = new RorApiClient();
