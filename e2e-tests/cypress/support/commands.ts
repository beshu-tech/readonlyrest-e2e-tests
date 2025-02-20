import '@testing-library/cypress/add-commands';

Cypress.Commands.add('kbnPost', ({ endpoint, credentials, payload, currentGroupHeader }, ...args) => {
  cy.kbnRequest({
    method: 'POST',
    endpoint: endpoint,
    credentials: credentials,
    payload: payload,
    currentGroupHeader: currentGroupHeader
  });
});

Cypress.Commands.add('esPost', ({ endpoint, credentials, payload }, ...args) =>
  cy.esRequest({
    method: 'POST',
    endpoint: endpoint,
    credentials: credentials,
    payload: payload
  })
);

Cypress.Commands.add('kbnPut', ({ endpoint, credentials, payload }, ...args) =>
  cy.kbnRequest({
    method: 'PUT',
    endpoint: endpoint,
    credentials: credentials,
    payload: payload
  })
);

Cypress.Commands.add('esPut', ({ endpoint, credentials, payload }, ...args) =>
  cy.esRequest({
    method: 'PUT',
    endpoint: endpoint,
    credentials: credentials,
    payload: payload
  })
);

Cypress.Commands.add('kbnImport', ({ endpoint, credentials, fixtureFilename }, ...args) =>
  uploadFile(`${Cypress.config().baseUrl}/${endpoint}`, credentials, fixtureFilename, { 'kbn-xsrf': 'true' })
);

Cypress.Commands.add('kbnGet', ({ endpoint, credentials, currentGroupHeader }, ...args) =>
  cy.kbnRequest({
    method: 'GET',
    endpoint: endpoint,
    credentials: credentials,
    currentGroupHeader: currentGroupHeader
  })
);

Cypress.Commands.add('esGet', ({ endpoint, credentials }, ...args) =>
  cy.esRequest({
    method: 'GET',
    endpoint: endpoint,
    credentials: credentials
  })
);

Cypress.Commands.add('kbnDelete', ({ endpoint, credentials, currentGroupHeader }, ...args) =>
  cy.kbnRequest({
    method: 'DELETE',
    endpoint: endpoint,
    credentials: credentials,
    currentGroupHeader: currentGroupHeader
  })
);

Cypress.Commands.add('esDelete', ({ endpoint, credentials }, ...args) =>
  cy.esRequest({
    method: 'DELETE',
    endpoint: endpoint,
    credentials: credentials
  })
);

Cypress.Commands.add('kbnRequest', ({ method, endpoint, credentials, payload, currentGroupHeader }) => {
  const customHeaders: { [key: string]: string } = { 'kbn-xsrf': 'true' };
  if (currentGroupHeader) {
    customHeaders['x-ror-current-group'] = currentGroupHeader;
  }
  httpCall(method, `${Cypress.config().baseUrl}/${endpoint}`, credentials, payload, customHeaders);
});

Cypress.Commands.add('esRequest', ({ method, endpoint, credentials, payload }) => {
  httpCall(method, `${Cypress.env().elasticsearchUrl}/${endpoint}`, credentials, payload);
});

function httpCall(
  method: string,
  url: string,
  credentials: string,
  payload?: string | object,
  headers?: { [key: string]: string }
): Cypress.Chainable<any> {
  const options = {
    method,
    url,
    headers: {
      'Content-Type': 'application/json',
      authorization: `Basic ${btoa(credentials)}`,
      ...headers
    },
    body: payload ? JSON.stringify(payload) : null
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

Cypress.on('uncaught:exception', (err, runnable) => {
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
    err.message.includes('e.toSorted is not a function') // kibana 8.15.0 throws this error on report generation
  ) {
    return false;
  }
});

Cypress.on('window:before:load', win => {
  class ResizeObserverMock {
    private callback: ResizeObserverCallback;
    private elements: Set<Element>;

    constructor(callback: ResizeObserverCallback) {
      // Debounce the callback to prevent ResizeObserver loops
      this.callback = Cypress._.debounce(callback, 200);
      this.elements = new Set();
    }

    observe(element: Element) {
      this.elements.add(element);

      // Simulate a resize event with a valid ResizeObserverEntry structure
      setTimeout(() => {
        if (this.elements.has(element)) {
          const entries: ResizeObserverEntry[] = [
            {
              target: element,
              contentRect: element.getBoundingClientRect(),
              borderBoxSize: [{ inlineSize: element.clientWidth, blockSize: element.clientHeight }],
              contentBoxSize: [{ inlineSize: element.clientWidth, blockSize: element.clientHeight }],
              devicePixelContentBoxSize: [{ inlineSize: element.clientWidth, blockSize: element.clientHeight }]
            } as ResizeObserverEntry
          ];
          this.callback(entries, this);
        }
      }, 200);
    }

    unobserve(element: Element) {
      this.elements.delete(element);
    }

    disconnect() {
      this.elements.clear();
    }
  }

  // Override ResizeObserver in the test environment
  win.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
});
