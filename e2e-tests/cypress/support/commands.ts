import '@testing-library/cypress/add-commands';
import 'cypress-network-idle';

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
  ({ endpoint, credentials, currentGroupHeader, impersonating, failOnStatusCode, headers }, ...args) =>
    cy.kbnRequest({
      method: 'GET',
      endpoint,
      credentials,
      currentGroupHeader,
      impersonating,
      failOnStatusCode,
      headers
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
      customHeaders['x-ror-current-group'] = currentGroupHeader;
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

/**
 * Chrome hands a headless test an empty clipboard. The permission grant below removes the
 * NotAllowedError, but the read still comes back as '', while Electron always returned the copied
 * text. So remember what the page copies — Kibana copies either through navigator.clipboard
 * .writeText or through document.execCommand('copy') over a selected node — and give the test that
 * text. The real clipboard stays as the fallback, which is the path Electron keeps taking.
 */
const COPIED_TEXT_KEY = '__rorCopiedText';

const rememberCopiedText = (win: Cypress.AUTWindow, text?: string | null) => {
  if (text) {
    (win as unknown as Record<string, string>)[COPIED_TEXT_KEY] = text;
  }
};

Cypress.on('window:before:load', win => {
  const { clipboard } = win.navigator;
  if (clipboard?.writeText) {
    const writeText = clipboard.writeText.bind(clipboard);
    clipboard.writeText = (text: string) => {
      rememberCopiedText(win, text);
      return writeText(text).catch(() => undefined);
    };
  }

  const execCommand = win.document.execCommand.bind(win.document);
  win.document.execCommand = (commandId: string, showUI?: boolean, value?: string) => {
    if (commandId === 'copy') {
      const active = win.document.activeElement;
      const isField = active instanceof win.HTMLInputElement || active instanceof win.HTMLTextAreaElement;
      rememberCopiedText(win, isField ? active.value : win.getSelection()?.toString());
    }
    return execCommand(commandId, showUI, value);
  };
});

/**
 * Chrome also refuses navigator.clipboard.readText() until the browser grants the permission.
 * Electron asks for nothing, so the grant runs only for a real Chromium browser. Without an origin,
 * CDP grants the permission to all origins.
 */
const grantClipboardRead = () => {
  if (Cypress.browser.family !== 'chromium' || Cypress.browser.name === 'electron') {
    return cy.wrap(null, { log: false });
  }
  return cy.wrap(
    Cypress.automation('remote:debugger:protocol', {
      command: 'Browser.grantPermissions',
      params: { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }
    }),
    { log: false }
  );
};

Cypress.Commands.add('getValueFromClipboard', () =>
  cy.window().then(win => {
    const copied = (win as unknown as Record<string, string>)[COPIED_TEXT_KEY];
    if (copied) {
      return cy.wrap(copied, { log: false });
    }
    return grantClipboardRead().then(() => {
      win.focus(); // headless Chrome reads the clipboard only for a focused document
      return win.navigator.clipboard.readText();
    });
  })
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
    err.message.includes("Cannot read properties of undefined (reading 'type')") || // kibana 7.x throws this error when run with ECK
    err.message.includes('Markdown content is required in [readOnly] mode') || // kibana 8.13.0 throws this error on sample data canvas open
    err.message.includes('e.toSorted is not a function') || // kibana 8.15.0 throws this error on report generation
    err.message.includes('Not Found') || // kibana 9.0.0-beta1 throws: Uncaught (in promise) http_fetch_error_HttpFetchError: Not Found
    err.message.includes('Loading chunk') // kibana 9.3.2
  ) {
    return false;
  }
});
