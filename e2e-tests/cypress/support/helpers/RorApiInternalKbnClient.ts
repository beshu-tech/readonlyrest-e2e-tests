import { BasicCredentials, kibanaCredentials } from './credentials';
import type { HttpResponse } from '../types';

export class RorApiInternalKbnClient {
  public getLicense({
    impersonating,
    credentials = kibanaCredentials
  }: { impersonating?: string; credentials?: BasicCredentials } = {}): Cypress.Chainable<
    HttpResponse<{ status?: string; message?: string; iss?: string }>
  > {
    return cy.kbnResponse({ endpoint: 'pkp/api/license', credentials, impersonating });
  }

  public deactivateTestSettings({
    credentials = kibanaCredentials
  }: { credentials?: BasicCredentials } = {}): Cypress.Chainable<void> {
    return cy.kbnDelete<void>({
      endpoint: 'pkp/api/test',
      credentials
    });
  }
}

export const rorApiInternalKbnClient = new RorApiInternalKbnClient();
