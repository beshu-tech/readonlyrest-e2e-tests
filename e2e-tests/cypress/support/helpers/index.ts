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
  // Kibana 8.19 has some changes of 9.1 that 9.0 does not have. Each caller names the change it checks.
  is819OrFrom91: () => semver.satisfies(getKibanaVersion(), '>=8.19.0 <9.0.0 || >=9.1.0')
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

// Leaves the Kibana page. Cypress then waits for no request of that page.
export const stopApp = () =>
  cy.window({ log: false }).then(win => {
    win.location.href = 'about:blank';
  });

let unansweredPageRequests = new Set<object>();

// Kibana completes a request also when the browser aborts it, for example because the page closes,
// and Cypress gives no signal for an aborted request. So stopAppAfterKibanaAnswers waits for the
// answers before it leaves the page. Call this before the page loads.
export const trackKibanaRequests = () => {
  cy.on('window:before:load', () => {
    // A request of the previous page has its answer, or the browser aborted it.
    unansweredPageRequests = new Set();
  });
  cy.intercept({ url: `${requiredBaseUrl()}/**` }, req => {
    const pageRequests = unansweredPageRequests;
    const request = {};
    pageRequests.add(request);
    req.on('response', () => {
      pageRequests.delete(request);
    });
  });
};

// Leaves the Kibana page after Kibana answers each request of the page, so no request of the page
// changes Kibana after this call. New requests of the page do not go to Kibana.
export const stopAppAfterKibanaAnswers = () => {
  cy.intercept({ url: `${requiredBaseUrl()}/**` }, req => req.destroy());
  cy.wrap(null, { log: false }).should(() =>
    expect(unansweredPageRequests.size, 'requests of the page that Kibana did not answer').to.equal(0)
  );
  stopApp();
};
