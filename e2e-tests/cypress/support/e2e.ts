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
import { installClipboardCapture, resetClipboardCapture } from './clipboardCapture';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Record what the app copies, so the specs never depend on the OS clipboard — see
// clipboardCapture.ts for why Chromium 138 makes that necessary.
Cypress.on('window:before:load', installClipboardCapture);
beforeEach(resetClipboardCapture);
/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    export interface Chainable<Subject> {
      kbnRequest({
        method,
        endpoint,
        credentials,
        payload,
        currentGroupHeader,
        failOnStatusCode,
        headers
      }: {
        method: string;
        endpoint: string;
        credentials: string;
        payload?: Payload;
        currentGroupHeader?: string;
        impersonating?: string;
        failOnStatusCode?: boolean;
        headers?: { [key: string]: string };
      }): Chainable<Subject>;
      kbnGet<T = Subject>({
        endpoint,
        credentials,
        currentGroupHeader,
        failOnStatusCode,
        headers
      }: {
        endpoint: string;
        credentials: string;
        currentGroupHeader?: string;
        impersonating?: string;
        failOnStatusCode?: boolean;
        headers?: { [key: string]: string };
      }): Chainable<T>;
      kbnPost<T = Subject>({
        endpoint,
        credentials,
        payload,
        currentGroupHeader,
        headers
      }: {
        endpoint: string;
        credentials: string;
        payload?: Payload;
        currentGroupHeader?: string;
        impersonating?: string;
        headers?: { [key: string]: string };
      }): Chainable<T>;
      kbnPut({
        endpoint,
        credentials,
        payload
      }: {
        endpoint: string;
        credentials: string;
        payload?: Payload;
      }): Chainable<Subject>;
      kbnImport({
        endpoint,
        credentials,
        fixtureFilename,
        currentGroupHeader
      }: {
        endpoint: string;
        credentials: string;
        fixtureFilename: string;
        currentGroupHeader?: string;
      }): Chainable<Subject>;
      kbnDelete<T = Subject>({
        endpoint,
        credentials,
        currentGroupHeader,
        failOnStatusCode
      }: {
        endpoint: string;
        credentials: string;
        currentGroupHeader?: string;
        impersonating?: string;
        failOnStatusCode?: boolean;
      }): Chainable<T>;

      esRequest({
        method,
        endpoint,
        credentials,
        payload,
        failOnStatusCode
      }: {
        method: string;
        endpoint: string;
        credentials: string;
        payload?: Payload;
        failOnStatusCode?: boolean;
      }): Chainable<Subject>;
      esGet<T = Subject>({ endpoint, credentials }: { endpoint: string; credentials: string }): Chainable<T>;
      esPost({
        endpoint,
        credentials,
        payload
      }: {
        endpoint: string;
        credentials: string;
        payload?: Payload;
      }): Chainable<Subject>;
      esPut({
        endpoint,
        credentials,
        payload
      }: {
        endpoint: string;
        credentials: string;
        payload?: Payload;
      }): Chainable<Subject>;
      esDelete({
        endpoint,
        credentials
      }: {
        endpoint: string;
        credentials: string;
        failOnStatusCode?: boolean;
      }): Chainable<Subject>;
      shouldHaveStyle(property: string, value: string): Chainable<Element>;
      getByDataTestSubj(value: string, options?: any): Chainable<JQuery<HTMLElement>>;
      findByDataTestSubj(value: string, options?: any): Chainable<JQuery<HTMLElement>>;
      getValueFromClipboard(): Chainable<string>;
      urlShouldMatch(urlPattern: string): Chainable<string>;
      waitForResponse(alias: `@${string}`): Chainable<{ statusCode: number }>;
    }

    type Payload = string | object;
  }
}
