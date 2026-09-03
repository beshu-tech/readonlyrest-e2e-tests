import { Login } from '../support/page-objects/Login';
import { ActivationKeys } from '../support/page-objects/ActivationKeys';
import { userCredentials } from '../support/helpers';

/**
 * Keys resolve in the order index -> env -> file -> bundled Free key. Loading a key through the UI
 * writes it to the index, which hides the env one; deleting it there uncovers the env one again.
 * That is why the delete below is a change from Free to Enterprise, and not a change to Free.
 */
// The docker env (elk-ror) runs 2 kbn-ror replicas behind kbn-proxy's round robin (see
// base.docker-compose.yml). Each node caches the ROR activation key in memory and only re-reads it
// from the index every activationKeyRefreshInterval (10m default), and independently wipes *all*
// shared sessions when it notices an edition change (readonlyrestkbn preKibanaProxy.ts
// verifyLicenseChange -> sessionManager.deleteAllSessions()). A single client's requests can land
// on nodes disagreeing about the current edition right after this test flips it, which is the same
// class of issue Kibana-config.cy.ts hit and skipped for the same reason. The eck-* environments
// run a single Kibana node (kind-cluster/ror/base/kbn.yml: count: 1) and are unaffected.
(Cypress.env().envName === 'elk-ror' ? describe.skip : describe)('Activation key', () => {
  beforeEach(() => {
    Login.initialization();
    ActivationKeys.open();
  });

  afterEach(() => {
    cy.kbnPost({
      endpoint: 'api/ror/license?overwrite=true',
      credentials: userCredentials,
      payload: { license: `${Cypress.env().enterpriseActivationKey}` }
    });
  });

  it('should log the user out when a new activation key changes the license edition', () => {
    // Enterprise (env) -> Free (index).
    ActivationKeys.changeLicenseToFree();

    cy.location('pathname').should('contain', '/login');
  });

  it('should keep the sessions when a new activation key has the same license edition', () => {
    ActivationKeys.changeLicenseToFree();
    cy.location('pathname').should('contain', '/login');
    // Logging in while on the Free edition: multi-tenancy requires Enterprise, so the
    // post-login redirect never carries ?tenancy= here.
    Login.initialization({ finishUrl: '/app/home' });
    ActivationKeys.open();

    // Free (index) -> Free: the edition does not change, so the sessions stay.
    ActivationKeys.changeLicenseToFree();

    // Reload instead of only reading the location: it sends the session cookie to the proxy again,
    // so this fails if the sessions were dropped. Reading the location alone passes as soon as the
    // page has not moved yet, which is also true when a logout is about to occur.
    cy.reload();
    cy.location('pathname').should('contain', '/s/default/app/home');
  });

  it('should log the user out when a deleted activation key uncovers a different license edition', () => {
    ActivationKeys.changeLicenseToFree();
    cy.location('pathname').should('contain', '/login');
    // Logging in while on the Free edition: multi-tenancy requires Enterprise, so the
    // post-login redirect never carries ?tenancy= here.
    Login.initialization({ finishUrl: '/app/home' });
    ActivationKeys.open();

    // Free (index) -> Enterprise (env).
    ActivationKeys.deleteLicense();

    cy.location('pathname').should('contain', '/login');
  });
});
