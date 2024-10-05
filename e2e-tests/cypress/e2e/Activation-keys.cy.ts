import { Login } from '../support/page-objects/Login';
import { ActivationKeys } from '../support/page-objects/ActivationKeys';
import { userCredentials } from '../support/helpers';

// TODO:
describe.skip('Activation key', () => {
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

  it('should verify activation key license change', () => {
    cy.log('logout user when a request from UI and license edition change\n');
    ActivationKeys.changeLicenseToFree();
    cy.location('pathname').should('contain', '/login');

    // TODO We need to find a way to pass message query string param on logout via session-probe
    // Login.hasLicenseChangedMessage();

    cy.log('The user stay on the page when a request from UI and license edition is the same\n');
    Login.initialization();
    ActivationKeys.open();
    ActivationKeys.changeLicenseToFree();
    cy.location('pathname').should('contain', '/s/default/app/home');

    cy.log('The user stay on the page when license deleted and license edition is the same');
    ActivationKeys.deleteLicense();
    cy.location('pathname').should('contain', '/s/default/app/home');

    // TODO Test it when we will be able to manipulate kibana.yml and change session probe interval
    // cy.log('Logout user when a request from API and license edition change\n');
    // cy.post({
    //   url: `"${Cypress.config().baseUrl}/api/ror/license?overwrite=true"`,
    //   payload: { license: `${Cypress.env().enterpriseActivationKey}` }
    // });
    // cy.location('pathname').should('contain', '/login');
    // Login.hasLicenseChangedMessage();

    // TODO Test it when we will be able to manipulate kibana.yml and change session probe interval
    // cy.log('The user stay on the page when a request from API and license edition is the same\n');
    // Login.initialization();
    // cy.post({
    //   url: `"${Cypress.config().baseUrl}/api/ror/license?overwrite=true"`,
    //   payload: { license: `${Cypress.env().enterpriseActivationKey}` }
    // });
    // cy.location('pathname').should('contain', '/s/default/app/home');
  });
});
