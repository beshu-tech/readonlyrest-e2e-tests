import '@testing-library/cypress/add-commands';

Cypress.Commands.add(
  'kbnPost',
  ({ endpoint, credentials, payload, currentGroupHeader, impersonating, headers }, ...args) => {
    cy.kbnRequest({
      method: 'POST',
      endpoint,
      credentials,
      payload,
      currentGroupHeader,
      headers,
      impersonating
    });
  }
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
    ...(currentGroupHeader ? { 'x-ror-current-group': currentGroupHeader } : {})
  })
);

Cypress.Commands.add(
  'kbnGet',
  ({ endpoint, credentials, currentGroupHeader, impersonating, failOnStatusCode }, ...args) =>
    cy.kbnRequest({
      method: 'GET',
      endpoint,
      credentials,
      currentGroupHeader,
      impersonating,
      failOnStatusCode
    })
);

Cypress.Commands.add('esGet', ({ endpoint, credentials }, ...args) =>
  cy.esRequest({
    method: 'GET',
    endpoint,
    credentials
  })
);

Cypress.Commands.add('kbnDelete', ({ endpoint, credentials, currentGroupHeader, impersonating }, ...args) =>
  cy.kbnRequest({
    method: 'DELETE',
    endpoint,
    credentials,
    currentGroupHeader,
    impersonating
  })
);

Cypress.Commands.add('esDelete', ({ endpoint, credentials }, ...args) =>
  cy.esRequest({
    method: 'DELETE',
    endpoint,
    credentials
  })
);

Cypress.Commands.add(
  'kbnRequest',
  ({ method, endpoint, credentials, payload, currentGroupHeader, impersonating, failOnStatusCode, headers }) => {
    const customHeaders: { [key: string]: string } = { 'kbn-xsrf': 'true', ...headers };
    if (currentGroupHeader) {
      customHeaders['x-ror-current-group'] = currentGroupHeader;
    }

    if (impersonating) {
      customHeaders['x-ror-impersonating'] = impersonating;
    }

    httpCall(method, `${Cypress.config().baseUrl}/${endpoint}`, credentials, payload, customHeaders, failOnStatusCode);
  }
);

Cypress.Commands.add('esRequest', ({ method, endpoint, credentials, payload }) => {
  httpCall(method, `${Cypress.env().elasticsearchUrl}/${endpoint}`, credentials, payload);
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
    body: payload ? JSON.stringify(payload) : null,
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
    err.message.includes('e.toSorted is not a function') || // kibana 8.15.0 throws this error on report generation
    err.message.includes('Not Found') // kibana 9.0.0-beta1 throws: Uncaught (in promise) http_fetch_error_HttpFetchError: Not Foun
  ) {
    return false;
  }
});
