import { Tenancy } from '../support/page-objects/Tenancy';
import { getIframeBody } from '../support/helpers/iframe';
import { Login } from '../support/page-objects/Login';

describe('JWT authentication', () => {
  const embeddedServerUrl = 'https://localhost:8080';
  const kibanaUrl = 'https://localhost:5601';

  before(() => {
    cy.task('startEmbeddedServer');
  });

  after(() => {
    cy.task('stopEmbeddedServer');
  });

  it('should load Kibana via JWT auth, bypass login and show the correct tenancy', () => {
    Login.suppressPostLoginNotices();
    cy.visit(embeddedServerUrl);

    getIframeBody('iframe').then(iframeBody => {
      cy.wrap(iframeBody)
        .find('[data-test-subj=globalLoadingIndicator-hidden]', { timeout: 60000 })
        .should('be.visible');

      cy.wrap(iframeBody).find('#form-username').should('not.exist');

      cy.wrap(iframeBody).within(() => {
        Tenancy.checkTenancyNameInBadge('infosec', 'a');
      });
    });
  });

  it('should redirect to login when JWT signature is tampered', () => {
    cy.task('generateJwt', {
      sub: 'admin',
      group: ['administrators', 'infosec', 'template'],
      iat: Math.floor(Date.now() / 1000)
    }).then(jwt => {
      const tampered = `${(jwt as string).slice(0, -4)}XXXX`;
      cy.visit(`${kibanaUrl}/s/default/app/home?jwt=${tampered}`);
      cy.get('#form-username', { timeout: 30000 }).should('be.visible');
    });
  });

  it('should redirect to login when JWT groups are not in the config', () => {
    cy.task('generateJwt', { sub: 'admin', group: ['unknown_group'], iat: Math.floor(Date.now() / 1000) }).then(jwt => {
      cy.visit(`${kibanaUrl}/s/default/app/home?jwt=${jwt}`);
      cy.get('#form-username', { timeout: 30000 }).should('be.visible');
    });
  });
});
