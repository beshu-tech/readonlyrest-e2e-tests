import { Login } from '../support/page-objects/Login';
import { Loader } from '../support/page-objects/Loader';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Discover } from '../support/page-objects/Discover';
import { Settings } from '../support/page-objects/Settings';

// todo: the test fails. Please fix me
describe.skip('Reporting index', () => {
  beforeEach(() => {
    Settings.setSettingsData('reportingSettings.yaml');
    cy.visit(Cypress.config().baseUrl);
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreTrialInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
    Login.signIn();
    Loader.loading();
  });

  afterEach(() => {
    Settings.setSettingsData('defaultSettings.yaml');
  });

  it('should correctly match index pattern when audit index_template contains .reporting', () => {
    const indexPattern = 'xxx.reporting';
    RorMenu.changeTenancy('Infosec', '/app/home#/');
    Discover.createIndexPattern(indexPattern);
    cy.contains('timestamp:').should('be.visible');
    cy.contains('acl_history:').should('be.visible');
    cy.contains(indexPattern).should('be.visible');
  });
});
