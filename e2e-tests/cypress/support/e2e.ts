import './commands';
import { installClipboardCapture, resetClipboardCapture } from './clipboardCapture';
import { kbnApiAdvancedClient } from './helpers/KbnApiAdvancedClient';
import { rorApiClient } from './helpers/RorApiClient';
import type { HttpResponse } from './types';

// Record what the app copies, so the specs never depend on the OS clipboard - see
// clipboardCapture.ts for why Chromium 138 makes that necessary.
Cypress.on('window:before:load', installClipboardCapture);
beforeEach(resetClipboardCapture);

// A spec that starts on a Kibana that does not answer user requests fails at its first login, and
// the cause stays hidden. Fail here instead, with the cause in the error.
before(() => kbnApiAdvancedClient.waitForKibanaToAnswerUserRequests());

// Every spec starts on the default ReadonlyREST settings. A spec that changes them restores them in
// an after hook, and a failed hook leaves the change for every later spec.
before(() => rorApiClient.configureRorIndexMainSettings('defaultSettings.yaml'));

/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    export interface Chainable<Subject> {
      kbnGet<T = unknown>(options: KbnRequestOptions): Chainable<T>;
      kbnPost<T = unknown>(options: KbnRequestOptions): Chainable<T>;
      kbnPut<T = unknown>(options: KbnRequestOptions): Chainable<T>;
      kbnDelete<T = unknown>(options: KbnRequestOptions): Chainable<T>;
      kbnResponse<T = unknown>(options: ResponseOptions<KbnRequestOptions>): Chainable<HttpResponse<T>>;
      kbnImport(options: {
        endpoint: string;
        credentials: string;
        fixtureFilename: string;
        currentGroupHeader?: string;
      }): Chainable<unknown>;
      esGet<T = unknown>(options: EsRequestOptions): Chainable<T>;
      esPost<T = unknown>(options: EsRequestOptions): Chainable<T>;
      esPut<T = unknown>(options: EsRequestOptions): Chainable<T>;
      esDelete<T = unknown>(options: EsRequestOptions): Chainable<T>;
      esResponse<T = unknown>(options: ResponseOptions<EsRequestOptions>): Chainable<HttpResponse<T>>;
      shouldHaveStyle(property: string, value: string): Chainable<Element>;
      getByDataTestSubj(
        value: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>
      ): Chainable<JQuery<HTMLElement>>;
      getValueFromClipboard(): Chainable<string>;
      urlShouldMatch(urlPattern: string): Chainable<string>;
      waitForResponse(alias: `@${string}`): Chainable<{ statusCode: number }>;
    }

    interface EsRequestOptions {
      endpoint: string;
      // The kibana user when not given.
      credentials?: string;
      // Sent as JSON.
      payload?: object;
      failOnStatusCode?: boolean;
      headers?: { [key: string]: string };
    }

    interface KbnRequestOptions extends EsRequestOptions {
      credentials: string;
      currentGroupHeader?: string;
      impersonating?: string;
    }

    // A response request yields any status, so it takes no failOnStatusCode.
    type ResponseOptions<Options> = Options & { method?: string; failOnStatusCode?: never };
  }
}
