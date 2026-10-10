import { kbnApiAdvancedClient } from './KbnApiAdvancedClient';
import { requiredBaseUrl } from './index';
import type { HttpResponse } from '../types';

export class RorApiInternalKbnClient {
  public getLicense({
    impersonating,
    credentials = Cypress.env().kibanaUserCredentials
  }: { impersonating?: string; credentials?: string } = {}): Cypress.Chainable<
    HttpResponse<{ status?: string; message?: string; iss?: string }>
  > {
    return cy.kbnResponse({ endpoint: 'pkp/api/license', credentials, impersonating });
  }

  public deactivateTestSettings({
    credentials = Cypress.env().kibanaUserCredentials
  }: { credentials?: string } = {}): Cypress.Chainable<void> {
    return cy.kbnDelete<void>({
      endpoint: 'pkp/api/test',
      credentials
    });
  }

  /**
   * Rewrites kibana.yml and restarts Kibana, then waits for it to serve again. The restart resets
   * the connection before the reply arrives, so a transport error is a normal outcome here.
   */
  public changeKibanaConfig(fixtureYamlFileName: string) {
    return cy
      .fixture(fixtureYamlFileName)
      .then(yamlContent =>
        cy.task('httpCall', {
          method: 'POST',
          url: `${Cypress.config().baseUrl}/pkp/api/kibanaConfig`,
          headers: {
            'Content-Type': 'application/yaml',
            'kbn-xsrf': 'true',
            authorization: `Basic ${btoa(Cypress.env().kibanaUserCredentials)}`
          },
          body: `${yamlContent}`,
          allowTransportError: true
        })
      )
      .then(response => {
        const status = (response as { status?: string } | null)?.status;
        const restarted = status === 'SUCCESS' || status === 'TRANSPORT_ERROR';

        if (!restarted) {
          cy.log(`kibanaConfig answered ${status ?? 'nothing recognisable'}: no restart to wait for`);
          return;
        }

        return kbnApiAdvancedClient.waitForKibanaRestart(requiredBaseUrl());
      });
  }
}

export const rorApiInternalKbnClient = new RorApiInternalKbnClient();
