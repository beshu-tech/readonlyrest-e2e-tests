// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')
/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    export interface Chainable<Subject> {
      kbnRequest({ method, endpoint, credentials, options }: { method: string, endpoint: string, credentials: string, options?: string }): Chainable<Subject>;
      kbnGet({ endpoint, credentials, currentGroupHeader }: { endpoint: string, credentials: string, currentGroupHeader?: string }): Chainable<Subject>;
      kbnPost({ endpoint, credentials, payload, currentGroupHeader }: { endpoint: string, credentials: string, payload?: unknown, currentGroupHeader?: string }): Chainable<Subject>;
      kbnPut({ endpoint, credentials, payload }: { endpoint: string, credentials: string, payload?: unknown }): Chainable<Subject>;
      kbnImport({endpoint, credentials, filename}: {endpoint: string, credentials: string, filename: string}): Chainable<Subject>;
      kbnDelete({ endpoint, credentials, currentGroupHeader }: { endpoint: string, credentials: string, currentGroupHeader?: string }): Chainable<Subject>;

      esRequest({ method, endpoint, credentials, options }: { method: string, endpoint: string, credentials: string, options?: string }): Chainable<Subject>;
      esGet({ endpoint, credentials }: { endpoint: string, credentials: string }): Chainable<Subject>;
      esPost({ endpoint, credentials, payload }: { endpoint: string, credentials: string, payload?: unknown }): Chainable<Subject>;
      esPut({ endpoint, credentials, payload }: { endpoint: string, credentials: string, payload?: unknown }): Chainable<Subject>;
      esDelete({ endpoint, credentials }: { endpoint: string, credentials: string }): Chainable<Subject>;
    }
  }
}
