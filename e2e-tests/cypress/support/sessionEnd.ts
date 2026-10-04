// A test that logs out ends the session while the Kibana page still runs. Until the login page
// shows, the requests of that page get 403 or the login page, and the app raises these errors:
// - ChunkLoadError, "Loading chunk N failed": a lazy chunk request gets HTML instead of JavaScript.
// - EmptyError "no elements in sequence": a Kibana observable completes without a value after a 403.
// - Error "Forbidden": Kibana core rejects the promise of a request that gets 403.
// The filter ignores only these errors, and only in that window. Elsewhere they still fail the test.
const SESSION_END_ERRORS = [/ChunkLoadError/, /Loading chunk \S+ failed/, /no elements in sequence/, /\bForbidden\b/];

let sessionEndInProgress = false;

export const expectSessionEnd = () => {
  cy.then(() => {
    sessionEndInProgress = true;
  });
};

export const sessionEndCompleted = () => {
  cy.then(() => {
    sessionEndInProgress = false;
  });
};

export const installSessionEndExceptionFilter = () => {
  beforeEach(() => {
    sessionEndInProgress = false;
  });

  Cypress.on('uncaught:exception', err => {
    const isSessionEndError = SESSION_END_ERRORS.some(pattern => pattern.test(`${err.name}: ${err.message}`));
    return sessionEndInProgress && isSessionEndError ? false : undefined;
  });
};
