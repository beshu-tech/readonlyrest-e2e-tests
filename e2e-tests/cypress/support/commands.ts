import '@testing-library/cypress/add-commands';
import { isJsonString } from './helpers';

Cypress.Commands.add('kbnPost', ({ endpoint, credentials, payload, currentGroupHeader }, ...args) => {
  cy.kbnRequest({
    method: "POST",
    endpoint: endpoint,
    credentials: credentials,
    payload: payload,
    currentGroupHeader: currentGroupHeader
  })
});

Cypress.Commands.add('esPost', ({ endpoint, credentials, payload }, ...args) =>
  cy.esRequest({
    method: "POST",
    endpoint: endpoint,
    credentials: credentials,
    payload: payload
  })
);

Cypress.Commands.add('kbnPut', ({ endpoint, credentials, payload }, ...args) =>
  cy.kbnRequest({
    method: "PUT",
    endpoint: endpoint,
    credentials: credentials,
    payload: payload
  })
);

Cypress.Commands.add('esPut', ({ endpoint, credentials, payload }, ...args) =>
  cy.esRequest({
    method: "PUT",
    endpoint: endpoint,
    credentials: credentials,
    payload: payload
  })
);

Cypress.Commands.add(
  'kbnImport',
  ({ endpoint, credentials, fixtureFilename }, ...args) =>
    uploadFile(
      `${Cypress.config().baseUrl}/${endpoint}`,
      credentials,
      fixtureFilename,
      { "kbn-xsrf": "true" }
    )
);

Cypress.Commands.add(
  'kbnGet',
  ({ endpoint, credentials, currentGroupHeader }, ...args) =>
    cy.kbnRequest({
      method: "GET",
      endpoint: endpoint,
      credentials: credentials,
      currentGroupHeader: currentGroupHeader
    })
)

Cypress.Commands.add(
  'esGet',
  ({ endpoint, credentials }, ...args) =>
    cy.esRequest({
      method: "GET",
      endpoint: endpoint,
      credentials: credentials
    })
);

Cypress.Commands.add(
  'kbnDelete',
  ({ endpoint, credentials, currentGroupHeader }, ...args) =>
    cy.kbnRequest({
      method: "DELETE",
      endpoint: endpoint,
      credentials: credentials,
      currentGroupHeader: currentGroupHeader
    })
);

Cypress.Commands.add(
  'esDelete',
  ({ endpoint, credentials }, ...args) =>
    cy.esRequest({
      method: "DELETE",
      endpoint: endpoint,
      credentials: credentials
    })
);

Cypress.Commands.add(
  'kbnRequest',
  ({ method, endpoint, credentials, payload, currentGroupHeader }) => {
    const customHeaders: { [key: string]: string } = { "kbn-xsrf": "true" };
    if (currentGroupHeader) {
      customHeaders['x-ror-current-group'] = currentGroupHeader;
    }
    call(method, `${Cypress.config().baseUrl}/${endpoint}`, credentials, payload, customHeaders)
  }
);

Cypress.Commands.add(
  'esRequest',
  ({ method, endpoint, credentials, payload }) => {
    call(method, `${Cypress.env().elasticsearchUrl}/${endpoint}`, credentials, payload)
  }
);

function call(method: string, url: string, credentials: string, payload?: Cypress.RequestBody, headers?: { [key: string]: string }) {
  cy.request({
    method: method,
    url: url,
    headers: {
      authorization: `Basic ${btoa(credentials)}`,
      ...headers
    },
    body: payload || null,
  }).then((response) => {
    console.log(`RR: ${method} ${url} ${credentials} ${JSON.stringify(headers)} = ${JSON.stringify(response)}`)
    // expect(response.status).to.be.within(200, 299);
    return isJsonString(response.body) ? JSON.parse(response.body) : response.body;
  })
}

function uploadFile(url: string, credentials: string, fixtureFilename: string, headers?: { [key: string]: string }) {
  cy.fixture(fixtureFilename, 'base64').then((fileContent) => {
    const formData = new FormData();
    formData.append('file', Cypress.Blob.base64StringToBlob(fileContent, 'application/octet-stream'), fixtureFilename);

    const requestHeaders = {
      authorization: `Basic ${btoa(credentials)}`,
      ...(headers || {}) 
    };

    cy.request({
      method: "POST",
      url: url,
      headers: requestHeaders,
      body: formData,
      // You might want to comment this out unless you're sure it should be sent
      // contentType: false, // This tells Cypress not to set the content-type, allowing FormData to set it
      // failOnStatusCode: false // Uncomment if you want to ignore 4xx/5xx responses temporarily
    }).then((response) => {
      expect(response.status).to.be.within(200, 299);
      return isJsonString(response.body) ? JSON.parse(response.body) : response.body;
    });
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
    err.message.includes('Markdown content is required in [readOnly] mode') || // kibana 8.13.0 throws this error on sample data canvas open
    err.message.includes('e.toSorted is not a function') // kibana 8.15.0 throws this error on report generation
  ) {
    return false;
  }
});
