import '@testing-library/cypress/add-commands';
import { isJsonString } from './helpers';

Cypress.Commands.add('kbnPost', ({endpoint, credentials, payload, currentGroupHeader, printLogs = true}, ...args) => {
  const payloadCurlPart = `-H "Content-Type: application/json" -d ${ JSON.stringify(JSON.stringify(payload || {})) }`
  cy.kbnRequest({
    method: "POST",
    endpoint: endpoint,
    credentials: credentials,
    options: currentGroupHeader ? `${ payloadCurlPart } -H "x-ror-current-group: ${ currentGroupHeader }"` : payloadCurlPart,
    printLogs: printLogs
  }).then(response => {
    return response;
  })
});

Cypress.Commands.add('esPost', ({endpoint, credentials, payload = [], printLogs = true}, ...args) => {
    const bulkPayload = payload.map(item => [
      {create: {}},
      item
    ]).flat().map(item => JSON.stringify(item)).join('\n') + '\n';

    cy.esRequest({
      method: "POST",
      endpoint: endpoint,
      credentials: credentials,
      options: `-H "Content-Type: application/json" -d'\n${ bulkPayload }'`,
      printLogs: printLogs
    }).then(response => {
      return response;
    })
  }
);

Cypress.Commands.add('kbnPut', ({endpoint, credentials, payload, printLogs = true}, ...args) =>
  cy.kbnRequest({
    method: "PUT",
    endpoint: endpoint,
    credentials: credentials,
    options: `-H "Content-Type: application/json" -d ${ JSON.stringify(JSON.stringify(payload || {})) }`,
    printLogs: printLogs
  }).then(response => {
    return response;
  })
);

Cypress.Commands.add('esPut', ({endpoint, credentials, payload = [], printLogs = true}, ...args) => {
  const bulkPayload = payload.map(item => JSON.stringify(JSON.stringify(item))).join('\n') + '\n'; // Join with newline

  cy.esRequest({
    method: "PUT",
    endpoint: endpoint,
    credentials: credentials,
    options: `-H "Content-Type: application/json" -d '\n${ bulkPayload }'`,
    printLogs: printLogs
  }).then(response => {
    return response;
  })
});

Cypress.Commands.add(
  'kbnImport',
  ({endpoint, credentials, filename, printLogs = true}, ...args) =>
    cy.kbnRequest({
      method: "POST",
      endpoint: endpoint,
      credentials: credentials,
      options: `--form file=@${ filename }`,
      printLogs: printLogs
    }).then(response => {
      return response;
    })
);

Cypress.Commands.add(
  'kbnGet',
  ({endpoint, credentials, currentGroupHeader, printLogs = true}, ...args) =>
    cy.kbnRequest({
      method: "GET",
      endpoint: endpoint,
      credentials: credentials,
      options: currentGroupHeader ? `-H "x-ror-current-group: ${ currentGroupHeader }"` : undefined,
      printLogs: printLogs
    }).then(response => {
      return response;
    })
)

Cypress.Commands.add(
  'esGet',
  ({endpoint, credentials, printLogs = true}, ...args) =>
    cy.esRequest({
      method: "GET",
      endpoint: endpoint,
      credentials: credentials,
      printLogs: printLogs
    }).then(response => {
      return response;
    })
);

Cypress.Commands.add(
  'kbnDelete',
  ({endpoint, credentials, currentGroupHeader, printLogs = true}, ...args) =>
    cy.kbnRequest({
      method: "DELETE",
      endpoint: endpoint,
      credentials: credentials,
      options: currentGroupHeader ? `-H "x-ror-current-group: ${ currentGroupHeader }"` : undefined,
      printLogs: printLogs
    }).then(response => {
      return response;
    })
);

Cypress.Commands.add(
  'esDelete',
  ({endpoint, credentials, printLogs = true}, ...args) =>
    cy.esRequest({
      method: "DELETE",
      endpoint: endpoint,
      credentials: credentials,
      printLogs: printLogs
    }).then(response => {
      return response;
    })
);

Cypress.Commands.add(
  'kbnRequest',
  ({method, endpoint, credentials, options, printLogs = true}) => {
    const url = `${ Cypress.config().baseUrl }/${ endpoint }`

    return cy
      .exec(`curl -H "kbn-xsrf: true" -v -k -X${ method } "${ url }" --user ${ credentials } ${ options || "" }`, {log: printLogs})
      .then(result => {
        if (printLogs) {
          console.log(url, result);
        }
        return isJsonString(result.stdout) ? JSON.parse(result.stdout) : result.stdout;
      })
  }
);


Cypress.Commands.add(
  'esRequest',
  ({method, endpoint, credentials, options, printLogs = true}) => {
    const url = `${ Cypress.env().elasticsearchUrl }/${ endpoint }`

    const command = `curl -H "kbn-xsrf: true" -v -k -X${ method } "${ url }" --user ${ credentials } ${ options || "" }`

    return cy
      .exec(command, {log: printLogs})
      .then(result => {

        console.log(url, command, result);

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
