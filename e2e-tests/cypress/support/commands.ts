import '@testing-library/cypress/add-commands';
import 'cypress-network-idle';
import * as semver from 'semver';
import { getKibanaVersion } from './helpers';
import { capture as clipboardCapture } from './clipboardCapture';

Cypress.Commands.add(
  'kbnPost',
  ({ endpoint, credentials, payload, currentGroupHeader, impersonating, headers }, ...args) =>
    cy.kbnRequest({
      method: 'POST',
      endpoint,
      credentials,
      payload,
      currentGroupHeader,
      headers,
      impersonating
    }) as Cypress.Chainable<unknown>
);

Cypress.Commands.add('esPost', ({ endpoint, credentials, payload }, ...args) =>
  cy.esRequest({
    method: 'POST',
    endpoint,
    credentials,
    payload
  })
);

Cypress.Commands.add('kbnPut', ({ endpoint, credentials, payload }, ...args) =>
  cy.kbnRequest({
    method: 'PUT',
    endpoint,
    credentials,
    payload
  })
);

Cypress.Commands.add('esPut', ({ endpoint, credentials, payload }, ...args) =>
  cy.esRequest({
    method: 'PUT',
    endpoint,
    credentials,
    payload
  })
);

Cypress.Commands.add('kbnImport', ({ endpoint, credentials, fixtureFilename, currentGroupHeader }, ...args) =>
  uploadFile(`${Cypress.config().baseUrl}/${endpoint}`, credentials, fixtureFilename, {
    'kbn-xsrf': 'true',
    'elastic-api-version': '2023-10-31',
    ...(currentGroupHeader ? { 'x-ror-tenancy-id': currentGroupHeader } : {})
  })
);

Cypress.Commands.add(
  'kbnGet',
  ({ endpoint, credentials, currentGroupHeader, impersonating, failOnStatusCode, headers }, ...args) =>
    cy.kbnRequest({
      method: 'GET',
      endpoint,
      credentials,
      currentGroupHeader,
      impersonating,
      failOnStatusCode,
      headers
    }) as Cypress.Chainable<unknown>
);

Cypress.Commands.add('esGet', ({ endpoint, credentials }, ...args) =>
  cy.esRequest({
    method: 'GET',
    endpoint,
    credentials
  }) as Cypress.Chainable<unknown>
);

Cypress.Commands.add(
  'kbnDelete',
  ({ endpoint, credentials, currentGroupHeader, impersonating, failOnStatusCode }, ...args) =>
    cy.kbnRequest({
      method: 'DELETE',
      endpoint,
      credentials,
      currentGroupHeader,
      impersonating,
      failOnStatusCode
    }) as Cypress.Chainable<unknown>
);

Cypress.Commands.add('esDelete', ({ endpoint, credentials, failOnStatusCode }, ...args) =>
  cy.esRequest({
    method: 'DELETE',
    endpoint,
    credentials,
    failOnStatusCode
  })
);

Cypress.Commands.add(
  'kbnRequest',
  ({ method, endpoint, credentials, payload, currentGroupHeader, impersonating, failOnStatusCode, headers }) => {
    const customHeaders: { [key: string]: string } = { 'kbn-xsrf': 'true', ...headers };
    if (currentGroupHeader) {
      customHeaders['x-ror-tenancy-id'] = currentGroupHeader;
    }

    if (impersonating) {
      customHeaders['x-ror-impersonating'] = impersonating;
    }

    httpCall(method, `${Cypress.config().baseUrl}/${endpoint}`, credentials, payload, customHeaders, failOnStatusCode);
  }
);

Cypress.Commands.add('esRequest', ({ method, endpoint, credentials, payload, failOnStatusCode }) => {
  httpCall(method, `${Cypress.env().elasticsearchUrl}/${endpoint}`, credentials, payload, undefined, failOnStatusCode);
});

function httpCall(
  method: string,
  url: string,
  credentials: string,
  payload?: string | object,
  headers?: { [key: string]: string },
  failOnStatusCode = true
): Cypress.Chainable<any> {
  const options = {
    method,
    url,
    headers: {
      'Content-Type': 'application/json',
      authorization: `Basic ${btoa(credentials)}`,
      ...headers
    },
    body: payload ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : null,
    failOnStatusCode
  };

  return cy.task('httpCall', options);
}

function uploadFile(
  url: string,
  credentials: string,
  fixtureFilename: string,
  headers?: { [key: string]: string }
): Cypress.Chainable<any> {
  return cy.fixture(fixtureFilename, 'binary').then(fileContent => {
    const options = {
      url,
      headers: {
        authorization: `Basic ${btoa(credentials)}`,
        ...headers
      },
      file: {
        fileName: fixtureFilename,
        fileBinaryContent: fileContent
      }
    };

    return cy.task('uploadFile', options);
  });
}

Cypress.Commands.add('shouldHaveStyle', { prevSubject: true }, (subject, property, value) => {
  cy.wrap(subject).should($el => {
    expect($el).to.exist;
    expect($el.length).to.be.at.least(1);

    const win = $el[0].ownerDocument.defaultView;
    const computedStyle = win.getComputedStyle($el[0]);
    const actualValue = computedStyle.getPropertyValue(property);

    // Handle RGB vs HEX color formats
    if (property === 'color' || property.includes('color')) {
      expect(actualValue.replace(/\s/g, '')).to.eq(value.replace(/\s/g, ''));
    } else {
      expect(actualValue).to.eq(value);
    }
  });
});

Cypress.Commands.add('getByDataTestSubj', (selector: string) => {
  return cy.get(`[data-test-subj="${selector}"]`);
});

Cypress.Commands.add('findByDataTestSubj', { prevSubject: 'element' }, (subject, value: string) => {
  const el = subject.find(`[data-test-subj="${value}"]`);
  return cy.wrap(el);
});

Cypress.Commands.add('urlShouldMatch', (urlPattern: string) => {
  const baseUrl = (Cypress.config().baseUrl ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedPath = urlPattern
    .replace(/\*/g, '\x00WILDCARD\x00')
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\x00WILDCARD\x00/g, '.+');
  const hasQueryOrHash = urlPattern.includes('?') || urlPattern.includes('#');
  const suffix = hasQueryOrHash ? '' : '(\\?[^#]*)?(#.*)?';
  return cy.url().should('match', new RegExp(`${baseUrl}${escapedPath}${suffix}$`));
});

// .its() re-reads the property on every retry, which .then() would not — see clipboardCapture.ts.
Cypress.Commands.add('getValueFromClipboard', () => cy.wrap(clipboardCapture, { log: false }).its('text'));

// Cypress 15 types cy.wait's alias parameter as `@${string}`; mirroring it here means a
// forgotten '@' prefix is a compile error instead of a silent numeric-wait.
Cypress.Commands.add('waitForResponse', (alias: `@${string}`) =>
  cy.wait(alias).then(({ response }) => {
    if (!response) throw new Error(`Expected a response for ${alias}`);
    return response;
  }) as unknown as Cypress.Chainable<{ statusCode: number }>
);

Cypress.on('uncaught:exception', (err, runnable) => {
  const kibanaVersion = getKibanaVersion();
  const isKibana8x = semver.satisfies(kibanaVersion, '>=8.0.0 <9.0.0');
  const isKibana819 = semver.satisfies(kibanaVersion, '>=8.19.0 <8.20.0');

  /**
   * Don't fail test when these specific errors from kibana platform
   */
  if (
    err.message.includes('ResizeObserver loop limit exceeded') ||
    err.message.includes('ResizeObserver loop completed with undelivered notifications.') || // kibana 8.11.0 and above throws this error
    err.message.includes('Unexpected token') || // Sometimes kibana js file chunks are not available, app works as expected but throw unhandled errors which fail the tests
    err.message.includes('ScopedHistory instance has fell out of navigation scope for basePath') ||
    err.message.includes("Cannot read properties of undefined (reading 'includes')") || // kibana 8.7.0 throws this error
    err.message.includes("Cannot read properties of undefined (reading 'type')") || // kibana 7.x throws this error when run with ECK
    err.message.includes('Markdown content is required in [readOnly] mode') || // kibana 8.13.0 throws this error on sample data canvas open
    err.message.includes('e.toSorted is not a function') || // kibana 8.15.0 throws this error on report generation
    err.message.includes('Not Found') || // kibana 9.0.0-beta1 throws: Uncaught (in promise) http_fetch_error_HttpFetchError: Not Found
    err.message.includes("Cannot read properties of undefined (reading 'id')") || // kibana 9.x Discover throws when opening with no data views in the tenant
    err.message.includes('endpoint is ignored by ReadonlyREST plugin') || // unsupportedEndpointsFilter.ts intercepts Kibana security endpoints with 501; some callers lack try-catch
    err.message.includes('Loading chunk') || // kibana 9.3.2 fails to fetch lazily loaded plugin chunks; affects every spec, so it stays global
    (isKibana8x && err.message.includes('ChunkLoadError')) || // kibana 8.x lazily loads plugin chunks; a reload can interrupt that load
    (isKibana8x && err.message.includes('executing a cancelled action')) || // kibana 8.x plugin lifecycle throws this on reload; can surface after the triggering test ends, so it must be suppressed globally (cy.on() inside a single it() doesn't cover afterEach)
    (isKibana819 && err.message.includes('toUpperCase is not a function')) // kibana 8.19.x throws this as an unhandled promise rejection from its own notifications module after cy.reload(); reproduced via automatic-tests/run.sh loop against User-settings.cy.ts
  ) {
    return false;
  }
});
