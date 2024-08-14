import '@testing-library/cypress/add-commands';
import { isJsonString } from './helpers';

Cypress.Commands.add('post', ({
                                url,
                                user = `${ Cypress.env().login }:${ Cypress.env().password }`,
                                payload
                              }, ...args) => {
  const escapedAndStringifyPayload = JSON.stringify(JSON.stringify(payload));

  return cy
    .exec(
      `curl -v -k -H "Content-Type: application/json" -H "kbn-xsrf: true" -d ${ escapedAndStringifyPayload }  -X POST ${ url }  --user ${ user }`
    )
    .then(result => {
      console.log(url, result);
      return isJsonString(result.stdout) ? JSON.parse(result.stdout) : result.stdout;
    });
});

Cypress.Commands.add(
  'import',
  ({url, filename, user = `${ Cypress.env().login }:${ Cypress.env().password }`}, ...args) =>
    cy.exec(`curl -v -k -H "kbn-xsrf: true" --form file=@${ filename }  -X POST "${ url }" --user ${ user }`).then(result => {
      console.log(url, result);
      return isJsonString(result.stdout) ? JSON.parse(result.stdout) : result.stdout;
    })
);

Cypress.Commands.add(
  'getRequest',
  ({url, user = `${ Cypress.env().login }:${ Cypress.env().password }`, header}, ...args) =>
    cy.exec(`curl -v -k "${ url }"  --user ${ user }  ${ header ? `-H "${ header }"` : '' }`).then(result => {
      console.log(url, result);
      return isJsonString(result.stdout) ? JSON.parse(result.stdout) : result.stdout;
    })
);

Cypress.Commands.add(
  'deleteRequest',
  ({url, header, user = `${ Cypress.env().login }:${ Cypress.env().password }`}, ...args) =>
    cy
      .exec(`curl  -H "kbn-xsrf: true" -v -k -X DELETE "${ url }"  --user ${ user } ${ header ? `-H "${ header }"` : '' }`)
      .then(result => {
        console.log(url, result);
        return isJsonString(result.stdout) ? JSON.parse(result.stdout) : result.stdout;
      })
);

Cypress.Commands.add('verifyDownload', (fileName: string, options) => {
  const downloadsFolder = Cypress.config().downloadsFolder;
  const downloadTimeout = options.timeout || 60000; // Default timeout of 60 seconds

  // Poll for the downloaded file
  cy.log(`Waiting for download: ${ fileName }`);
  return cy.readFile(`${ downloadsFolder }/${ fileName }`, {timeout: downloadTimeout})
    .then(fileContent => {
      cy.log(`Downloaded file: ${ fileName }`);
      return Cypress.Promise.resolve(`${ downloadsFolder }/${ fileName }`);
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
    err.message.includes('Markdown content is required in [readOnly] mode') // kibana 8.13.0 throws this error on sample data canvas open
  ) {
    return false;
  }
});
