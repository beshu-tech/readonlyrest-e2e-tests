import { Login } from '../support/page-objects/Login';
import { ActivationKeys } from '../support/page-objects/ActivationKeys';
import { EnvName } from '../support/types';
import { stopApp } from '../support/helpers';

// ROR KBN answers an edition change before it deletes the sessions (RORDEV-2302). A page that
// loads in between keeps its session until the next session probe, which runs every 30 s.
const LOGOUT_TIMEOUT_MS = 45000;
const SESSION_DELETE_WINDOW_MS = 5000;

// The docker env runs 2 Kibana nodes behind a round-robin proxy. Each node re-reads the key only
// every 10 minutes and deletes all sessions when it sees an edition change. After this test changes
// the edition, the nodes disagree. The eck envs run 1 Kibana node.
(Cypress.env().envName === EnvName.ELK_ROR ? describe.skip : describe)('Activation key', () => {
  beforeEach(() => {
    Login.initialization();
    ActivationKeys.open();
  });

  afterEach(() => {
    // A Kibana page that loses its session during the restore fails the hook with an uncaught error.
    stopApp();
    ActivationKeys.restoreEnterpriseKey();
  });

  it('should log the user out when a new activation key changes the license edition', () => {
    // Enterprise (env) -> Free (index).
    ActivationKeys.changeLicenseToFree();

    cy.location('pathname', { timeout: LOGOUT_TIMEOUT_MS }).should('contain', '/login');
    ActivationKeys.verifyEdition('kbn_free');
  });

  it('should keep the sessions when a new activation key has the same license edition', () => {
    ActivationKeys.changeLicenseToFree();
    cy.location('pathname', { timeout: LOGOUT_TIMEOUT_MS }).should('contain', '/login');
    // Logging in while on the Free edition: multi-tenancy requires Enterprise, so the
    // post-login redirect never carries ?tenancy= here.
    Login.initialization({ finishUrl: '/s/default/app/home' });
    ActivationKeys.open();

    // Free (index) -> Free: the edition does not change, so the sessions stay.
    ActivationKeys.changeLicenseToFree();
    ActivationKeys.verifyEdition('kbn_free');

    // ROR KBN deletes the sessions after it answers (RORDEV-2302), so the check that they stay waits
    // until such a delete is over. The delete takes well under a second.
    cy.wait(SESSION_DELETE_WINDOW_MS);
    ActivationKeys.sessionIndexStatus().should('equal', 200);
    // The reload sends the session cookie to the proxy again, so this fails if the sessions were dropped.
    cy.reload();
    cy.location('pathname').should('contain', '/s/default/app/home');
  });

  it('should log the user out when a deleted activation key uncovers a different license edition', () => {
    ActivationKeys.changeLicenseToFree();
    cy.location('pathname', { timeout: LOGOUT_TIMEOUT_MS }).should('contain', '/login');
    // Logging in while on the Free edition: multi-tenancy requires Enterprise, so the
    // post-login redirect never carries ?tenancy= here.
    Login.initialization({ finishUrl: '/s/default/app/home' });
    ActivationKeys.open();

    // Free (index) -> Enterprise (env). Keys resolve in the order index, env, file, bundled Free
    // key, so the delete uncovers the env key.
    ActivationKeys.deleteLicense();

    cy.location('pathname', { timeout: LOGOUT_TIMEOUT_MS }).should('contain', '/login');
    ActivationKeys.verifyEdition('kbn_ent');
  });
});
