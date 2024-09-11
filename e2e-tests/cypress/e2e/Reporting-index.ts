import { Login } from '../support/page-objects/Login';
import { Loader } from '../support/page-objects/Loader';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Discover } from '../support/page-objects/Discover';
import defaultSettingsData from '../fixtures/defaultSettings.json';
import reportingSettingsData from '../fixtures/reportingSettings.json';
import { Settings } from '../support/page-objects/Settings';

describe.skip('Reporting index', () => {
  beforeEach(() => {
    Settings.setSettingsData(reportingSettingsData);
    cy.visit(Cypress.config().baseUrl);
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreTrialInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
    Login.signIn();
    Loader.loading();
  });

  afterEach(() => {
    Settings.setSettingsData(defaultSettingsData);
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
