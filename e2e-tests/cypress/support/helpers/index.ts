import * as semver from 'semver';

let kibanaVersionUnderTest: string | undefined;

// run-tests.sh passes the version with --env kibanaVersion.
export const getKibanaVersion = (): string => {
  if (!kibanaVersionUnderTest) {
    const value: string = Cypress.env('kibanaVersion');
    if (!semver.valid(value)) {
      throw new Error(`Cypress env kibanaVersion is not a version: "${value}". Pass --env kibanaVersion=<version>.`);
    }
    kibanaVersionUnderTest = value;
  }
  return kibanaVersionUnderTest;
};

export const kibanaVersion = {
  gte: (version: string) => semver.gte(getKibanaVersion(), version),
  lt: (version: string) => semver.lt(getKibanaVersion(), version),
  lte: (version: string) => semver.lte(getKibanaVersion(), version),
  satisfies: (range: string) => semver.satisfies(getKibanaVersion(), range),
  // Kibana 8.19 has the features of 9.1, which 9.0 does not have.
  has91Features: () => semver.satisfies(getKibanaVersion(), '>=8.19.0 <9.0.0 || >=9.1.0')
};

export function requiredBaseUrl(): string {
  const baseUrl = Cypress.config('baseUrl');
  if (!baseUrl) throw new Error('Cypress baseUrl is not configured');
  return baseUrl;
}

// Pastes the text into the element: one paste event, with no key events.
export function pasteText(element: HTMLElement, text: string) {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', text);
  element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
}

export const stopApp = () =>
  cy.window({ log: false }).then(win => {
    win.location.href = 'about:blank';
  });
