import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { Loader } from '../support/page-objects/Loader';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { getKibanaVersion, userCredentials } from '../support/helpers';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { Spaces } from '../support/page-objects/Spaces';

const SPACE_NAME = 'Test space';

describe('Spaces', () => {
  beforeEach(() => {
    cy.visit(Cypress.config().baseUrl);
    cy.on('url:changed', () => {
      sessionStorage.setItem('ror:ignoreKeyExpirationInfo', 'true');
      localStorage.setItem('home:welcome:show', 'false');
    });
    Login.signIn();
    Loader.loading();
  });

  afterEach(() => {
    kbnApiAdvancedClient.deleteAllSpaces(userCredentials);
  });

  it('should successfully set feature visibility for default space', () => {
    cy.log('Navigate to default space management');
    cy.get('[data-test-subj=spacesNavSelector]').click();
    cy.contains('Manage spaces').should('be.visible').click({ force: true });
    cy.contains('Default').click();

    cy.log('Set feature visibility to hidden');
    Spaces.openEditSpace('default');
    cy.get('#featureCategoryCheckbox_kibana').uncheck();
    cy.get('[data-test-subj=save-space-button]').click();
    cy.get('[data-test-subj=confirmModalConfirmButton]').click({ force: true });

    cy.log('Check if feature in space hidden');
    cy.contains('Loading Elastic', { timeout: 80000 }).should('exist');
    cy.contains('Loading Elastic', { timeout: 80000 }).should('not.exist');
    cy.url().should('include', `${Cypress.config().baseUrl}/s/default/app/management/kibana/spaces/`);
    KibanaNavigation.openHomepage();
    KibanaNavigation.openKibanaNavigation();
    KibanaNavigation.checkIfNotExists('Analytics');

    const clearAllChanges = () => {
      cy.log('Navigate to default space management');
      cy.get('[data-test-subj=spacesNavSelector]').click();
      cy.contains('Manage spaces').should('be.visible').click({ force: true });
      cy.contains('Default').click();

      cy.log('Clear all changes');
      if (semver.gte(getKibanaVersion(), '8.16.0')) {
        cy.get('[data-test-subj="manageSpaces"]').click();
        cy.get('[data-test-subj="default-hyperlink"]').click();
      } else if (semver.gte(getKibanaVersion(), '8.4.0')) {
        cy.get('[data-test-subj=Default-editSpace]').click();
      }
      cy.get('#featureCategoryCheckbox_kibana').check();
      cy.get('[data-test-subj=save-space-button]').click();
      cy.get('[data-test-subj=confirmModalConfirmButton]').click({ force: true });
    };

    clearAllChanges();
  });

  it('should create and navigate to new space with hidden features', () => {
    Spaces.createNewSpace(SPACE_NAME);

    cy.log('Switch to newly created space');
    cy.get('[data-test-subj=spacesNavSelector]').click();
    cy.contains('Manage spaces', { timeout: 10000 }).should('be.visible');
    if (semver.gte(getKibanaVersion(), '8.4.0')) {
      cy.get('[data-test-subj=test-space-selectableSpaceItem]', { timeout: 10000 }).click();
    } else {
      cy.get('a[href="/s/test-space/spaces/enter"]', { timeout: 10000 }).should('be.visible').click({ force: true });
    }
    cy.contains('Loading Elastic', { timeout: 80000 }).should('not.exist');
    cy.url().should('include', `${Cypress.config().baseUrl}/s/test-space/app/home`);

    cy.log('Check if feature in space hidden');
    KibanaNavigation.openHomepage();
    KibanaNavigation.openKibanaNavigation();
    KibanaNavigation.checkIfNotExists('Analytics');

    Spaces.removeSpace(SPACE_NAME);
  });

  it('should hide space permission tab and not permit to navigate to itm', () => {
    cy.log('Navigate to default space management');
    cy.get('[data-test-subj=spacesNavSelector]').click();
    cy.contains('Manage spaces').should('be.visible').click({ force: true });
    cy.contains('Default').click();

    Spaces.openEditSpace('default');
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      cy.log('check if space manage permissions tab hidden');
      cy.contains('a[role="tab"]', /general settings/i).should('be.visible');
      cy.contains('a[role="tab"]', /permissions/i).should('not.be.visible');
      cy.log('check if space manage permissions tab not permitted');
      cy.visit('/s/default/app/management/kibana/spaces/edit/default/roles');
      cy.url().should('include', `${Cypress.config().baseUrl}/s/default/app/home`);
    }
  });
});
