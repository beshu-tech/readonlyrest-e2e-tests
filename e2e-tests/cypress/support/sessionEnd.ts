// A test that logs out ends the session while the Kibana page still runs. Until the login page
// shows, the requests of that page get 403 or the login page, and the app raises these errors:
// - ChunkLoadError, "Loading chunk N failed": a lazy chunk request gets HTML instead of JavaScript.
// - EmptyError "no elements in sequence": a Kibana observable completes without a value after a 403.
// - Error "Forbidden": Kibana core rejects the promise of a request that gets 403.
// The filter ignores only these errors, and only in that window. Elsewhere they still fail the test.
const SESSION_END_ERRORS = [/ChunkLoadError/, /Loading chunk \S+ failed/, /no elements in sequence/, /\bForbidden\b/];

// Cypress bundles the support file and each spec separately, so a module variable has one copy per
// bundle. The page objects set the flag in the spec bundle, and the filter reads it in the support
// bundle. Both bundles run in the same window, so the flag lives on the window.
type SessionEndState = { rorSessionEndInProgress?: boolean };
const state = globalThis as unknown as SessionEndState;

const setSessionEndInProgress = (value: boolean) => {
  state.rorSessionEndInProgress = value;
};

export const expectSessionEnd = () => {
  cy.then(() => setSessionEndInProgress(true));
};

export const sessionEndCompleted = () => {
  cy.then(() => setSessionEndInProgress(false));
};

export const installSessionEndExceptionFilter = () => {
  beforeEach(() => setSessionEndInProgress(false));

  Cypress.on('uncaught:exception', err => {
    const isSessionEndError = SESSION_END_ERRORS.some(pattern => pattern.test(`${err.name}: ${err.message}`));
    return state.rorSessionEndInProgress === true && isSessionEndError ? false : undefined;
  });
};
