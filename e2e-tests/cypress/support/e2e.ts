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
      post({ url, user, payload }: { url: string; user?: string; payload: unknown }): Chainable<Subject>;
      import({ url, user, filename }: { url: string; user?: string; filename: string }): Chainable<Subject>;
      getRequest({ url, user, header }: { url: string; user?: string; header?: string }): Chainable<Subject>;
      deleteRequest({ url, user, header }: { url: string; user?: string; header?: string }): Chainable<Subject>;
      verifyDownload({ fileName, options }: { fileName: string; options:? Cypress.ChainableMethods }): Chainable<Subject>;
    }
  }
}
