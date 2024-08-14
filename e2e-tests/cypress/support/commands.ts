import '@testing-library/cypress/add-commands';
import { isJsonString } from './helpers';

Cypress.Commands.add('kbnPost', ({ endpoint, credentials, payload, currentGroupHeader }, ...args) => {
  const payloadCurlPart = `-H "Content-Type: application/json" -d ${JSON.stringify(JSON.stringify(payload || {}))}`
  cy.kbnRequest({
    method: "POST",
    endpoint: endpoint,
    credentials: credentials,
    options: currentGroupHeader ? `${payloadCurlPart} -H "x-ror-current-group: ${currentGroupHeader}"` : payloadCurlPart
  })
});

Cypress.Commands.add('esPost', ({ endpoint, credentials, payload }, ...args) =>
  cy.esRequest({
    method: "POST",
    endpoint: endpoint,
    credentials: credentials,
    options: `-H "Content-Type: application/json" -d ${JSON.stringify(JSON.stringify(payload || {}))}`
  })
);

Cypress.Commands.add('kbnPut', ({ endpoint, credentials, payload }, ...args) =>
  cy.kbnRequest({
    method: "PUT",
    endpoint: endpoint,
    credentials: credentials,
    options: `-H "Content-Type: application/json" -d ${JSON.stringify(JSON.stringify(payload || {}))}`
  })
);

Cypress.Commands.add('esPut', ({ endpoint, credentials, payload }, ...args) =>
  cy.esRequest({
    method: "PUT",
    endpoint: endpoint,
    credentials: credentials,
    options: `-H "Content-Type: application/json" -d ${JSON.stringify(JSON.stringify(payload || {}))}`
  })
);

Cypress.Commands.add(
  'kbnImport',
  ({ endpoint, credentials, filename }, ...args) =>
    cy.kbnRequest({
      method: "POST",
      endpoint: endpoint,
      credentials: credentials,
      options: `--form file=@${filename}`
    })
);

Cypress.Commands.add(
  'kbnGet',
  ({ endpoint, credentials, currentGroupHeader }, ...args) =>
    cy.kbnRequest({
      method: "GET",
      endpoint: endpoint,
      credentials: credentials,
      options: currentGroupHeader ? `-H "x-ror-current-group: ${currentGroupHeader}"` : undefined
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
      options: currentGroupHeader ? `-H "x-ror-current-group: ${currentGroupHeader}"` : undefined
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
  ({ method, endpoint, credentials, options}) => {
    const url = `${Cypress.config().baseUrl}/${endpoint}`
    cy
      .exec(`curl  -H "kbn-xsrf: true" -v -k -X ${method} "${url}" --user ${credentials} ${options || ""}`)
      .then(result => {
        console.log(url, result);
        return isJsonString(result.stdout) ? JSON.parse(result.stdout) : result.stdout;
      })
  }
);

Cypress.Commands.add(
  'esRequest',
  ({ method, endpoint, credentials, options }) => {
    const url = `${Cypress.env().elasticsearchUrl}/${endpoint}`
    cy
      .exec(`curl  -H "kbn-xsrf: true" -v -k -X ${method} "${url}" --user ${credentials} ${options || ""}`)
      .then(result => {
        console.log(url, result);
        return isJsonString(result.stdout) ? JSON.parse(result.stdout) : result.stdout;
      })
  }
);

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
