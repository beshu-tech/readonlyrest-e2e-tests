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
      kbnRequest({ method, endpoint, credentials, options, printLogs }: { method: string, endpoint: string, credentials: string, options?: string, printLogs?: boolean }): Chainable<Subject>;
      kbnGet({ endpoint, credentials, currentGroupHeader, printLogs }: { endpoint: string, credentials: string, currentGroupHeader?: string, printLogs?: boolean }): Chainable<Subject>;
      kbnPost({ endpoint, credentials, payload, currentGroupHeader, printLogs }: { endpoint: string, credentials: string, payload?: unknown, currentGroupHeader?: string, printLogs?: boolean }): Chainable<Subject>;
      kbnPut({ endpoint, credentials, payload, printLogs }: { endpoint: string, credentials: string, payload?: unknown, printLogs?: boolean }): Chainable<Subject>;
      kbnImport({endpoint, credentials, filename, printLogs }: {endpoint: string, credentials: string, filename: string, printLogs?: boolean }): Chainable<Subject>;
      kbnDelete({ endpoint, credentials, currentGroupHeader, printLogs }: { endpoint: string, credentials: string, currentGroupHeader?: string, printLogs?: boolean }): Chainable<Subject>;

      esRequest({ method, endpoint, credentials, options, printLogs }: { method: string, endpoint: string, credentials: string, options?: string, printLogs?: boolean }): Chainable<Subject>;
      esGet({ endpoint, credentials, printLogs }: { endpoint: string, credentials: string, printLogs?: boolean }): Chainable<Subject>;
      esPost({ endpoint, credentials, payload, printLogs }: { endpoint: string, credentials: string, payload?: object[], printLogs?: boolean }): Chainable<Subject>;
      esPut({ endpoint, credentials, payload, printLogs }: { endpoint: string, credentials: string, payload?: object[], printLogs?: boolean }): Chainable<Subject>;
      esDelete({ endpoint, credentials, printLogs }: { endpoint: string, credentials: string, printLogs?: boolean }): Chainable<Subject>;
    }
  }
}
