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

type TrackedRequest = { name: string; sentAt: number };

// Kibana completes a request also when the browser aborts it, and Cypress gives no signal for the abort.
// So the wait cannot end at the abort: it gives each unanswered request this long from when it was sent.
// A normal answer takes about 1 s, so 10 s is a wide margin. It also bounds the wait for a request that never answers.
const KIBANA_MAX_ANSWER_MS = 10000;

// Cypress clears aliases at the start of each test, so a test never sees the requests of the test before it.
const REQUESTS_ALIAS = 'kibanaRequests';

const blockNewKibanaRequests = () => cy.intercept({ url: `${requiredBaseUrl()}/**` }, req => req.destroy());

export const trackKibanaRequests = () => {
  const requests = new Set<TrackedRequest>();
  cy.wrap(requests, { log: false }).as(REQUESTS_ALIAS);
  cy.window({ log: false }).then(win => {
    if (win.location.href !== 'about:blank') {
      throw new Error(`trackKibanaRequests() sees no request of the loaded page ${win.location.href}.`);
    }
  });
  cy.intercept({ url: `${requiredBaseUrl()}/**` }, req => {
    const request = { name: `${req.method} ${req.url}`, sentAt: Date.now() };
    requests.add(request);
    req.on('response', () => {
      requests.delete(request);
    });
  });
};

export const stopAppAfterKibanaAnswers = (afterStop: () => void) => {
  const namesOf = (tracked: TrackedRequest[]) => tracked.map(request => request.name);
  const isSettled = (request: TrackedRequest) => Date.now() - request.sentAt >= KIBANA_MAX_ANSWER_MS;

  cy.get<Set<TrackedRequest>>(`@${REQUESTS_ALIAS}`, { log: false }).then(requests => {
    blockNewKibanaRequests();
    cy.wrap(null, { log: false, timeout: KIBANA_MAX_ANSWER_MS + 1000 }).should(() =>
      expect(
        namesOf([...requests].filter(request => !isSettled(request))),
        'requests of the test that Kibana can still complete'
      ).to.deep.equal([])
    );
    cy.then(() => {
      if (requests.size > 0) {
        cy.log(`No answer from Kibana, or the browser aborted: ${namesOf([...requests]).join(', ')}`);
      }
    });
    stopApp();
    afterStop();
  });
};
