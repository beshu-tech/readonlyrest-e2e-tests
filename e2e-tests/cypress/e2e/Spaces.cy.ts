import { Login } from '../support/page-objects/Login';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { Spaces } from '../support/page-objects/Spaces';
import { ManageSpaces } from '../support/page-objects/ManageSpaces';
import { itOnKibana } from '../support/helpers/itOnKibana';
import { admin } from '../support/helpers/credentials';

const SPACE_NAME = 'Test space';

describe('Spaces', () => {
  beforeEach(() => {
    kbnApiAdvancedClient.resetSpaces(admin);
    Login.initialization();
  });

  afterEach(() => {
    kbnApiAdvancedClient.tryResetSpaces(admin);
  });

  it('should successfully set feature visibility for default space', () => {
    cy.log('Set feature visibility to hidden');
    ManageSpaces.openEditSpacePage('default', 'Default');
    cy.get('#featureCategoryCheckbox_kibana').uncheck();
    Spaces.saveCurrentSpaceFeatures();

    cy.log('Check if feature in space hidden');
    cy.url().should('include', `${Cypress.config().baseUrl}/s/default/app/management/kibana/spaces/`);
    KibanaNavigation.openHomepage();
    KibanaNavigation.openKibanaNavigation();
    KibanaNavigation.checkIfNotExists('Analytics');

    cy.log('Clear all changes');
    ManageSpaces.openEditSpacePage('default', 'Default');
    cy.get('#featureCategoryCheckbox_kibana').check();
    Spaces.saveCurrentSpaceFeatures();
  });

  // FIXME: for Kibana 9.1.0 there is a new .kibana_security_search index not handled on es side yet
  itOnKibana('<9.1.0', 'should create and navigate to new space with hidden features', () => {
    Spaces.createNewSpace(SPACE_NAME);

    cy.log('Switch to newly created space');
    Spaces.openSpace(Spaces.idOf(SPACE_NAME));
    cy.contains('Loading Elastic', { timeout: 80000 }).should('not.exist');
    cy.url().should('include', `${Cypress.config().baseUrl}/s/test-space/app/home`);

    cy.log('Check if feature in space hidden');
    KibanaNavigation.openHomepage();
    KibanaNavigation.openKibanaNavigation();
    KibanaNavigation.checkIfNotExists('Analytics');

    Spaces.removeSpace(SPACE_NAME);
  });

  // Kibana shows the space permissions tab from 8.16.0.
  itOnKibana('>=8.16.0', 'should hide space permission tab and not permit to navigate to it', () => {
    ManageSpaces.openEditSpacePage('default', 'Default');
    cy.log('check if space manage permissions tab hidden');
    cy.contains('a[role="tab"]', /general settings/i).should('be.visible');
    cy.contains('a[role="tab"]', /permissions/i).should('not.be.visible');
    cy.log('check if space manage permissions tab not permitted');
    cy.visit('/s/default/app/management/kibana/spaces/edit/default/roles');
    cy.url().should('include', `${Cypress.config().baseUrl}/s/default/app/home`);
  });
});
