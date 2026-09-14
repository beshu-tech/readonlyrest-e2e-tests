import * as semver from 'semver';
import { getKibanaVersion } from '../helpers';

export class Spaces {
  static removeSpace(spaceName: string) {
    cy.log('Remove space');
    const spaceNameLowerCaseAndDash = spaceName.toLowerCase().replace(' ', '-');

    cy.get('[data-test-subj=spacesNavSelector]').click();
    cy.get('[data-test-subj=manageSpaces]').click({ force: true });
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      cy.get(`[id="${spaceNameLowerCaseAndDash}-actions"]`).click();
      cy.get(`[data-test-subj="${spaceNameLowerCaseAndDash}-deleteSpace"]`).click();
    } else {
      cy.get(`[data-test-subj="${spaceName}-deleteSpace"]`).click();
    }

    cy.intercept(`s/${spaceNameLowerCaseAndDash}/api/spaces/space/${spaceNameLowerCaseAndDash}`).as('deleteSpace');
    cy.get('[data-test-subj=confirmModalConfirmButton]').click({ force: true });
    cy.waitForResponse('@deleteSpace').then(response => {
      expect([204]).to.include(response.statusCode);
    });
  }

  static saveSpaceAndConfirm() {
    cy.get('[data-test-subj=save-space-button]').click();
    cy.get('body').then($body => {
      if ($body.find('[data-test-subj=confirmModalConfirmButton]').length > 0) {
        cy.get('[data-test-subj=confirmModalConfirmButton]').click({ force: true });
      }
    });
  }

  static openEditSpace(spaceName: string) {
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      cy.get('[data-test-subj="manageSpaces"]').click();
      cy.get(`[data-test-subj="${spaceName}-hyperlink"]`).click();
    } else if (semver.gte(getKibanaVersion(), '8.4.0')) {
      cy.get(`[data-test-subj="${spaceName}-editSpace"]`).click();
    }
  }

  static createNewSpace(spaceName: string) {
    cy.log('Create new space');
    Spaces.navigateToCreateSpacePage();
    cy.get('[data-test-subj=addSpaceName]').type(spaceName);
    cy.get('#featureCategoryCheckbox_kibana').uncheck();

    if (semver.gte(getKibanaVersion(), '8.18.0')) {
      cy.get('[data-test-subj="solutionViewSelect"]').click();
      cy.get('[data-test-subj="solutionViewClassicOption"]').click();
    }

    cy.get('[data-test-subj=save-space-button]').click();
    cy.contains(`Space '${spaceName}' was saved.`);
  }

  static navigateToCreateSpacePage() {
    cy.getByDataTestSubj('spacesNavSelector').click();
    // EUI toggles this popover on click, and the first synthesized click sometimes
    // lands while the header re-renders, leaving the popover shut. Toggle again if
    // the entry is absent; the assertion then holds the real state.
    cy.get('body').then($body => {
      if ($body.find('[data-test-subj=manageSpaces]').length === 0) {
        cy.getByDataTestSubj('spacesNavSelector').click();
      }
    });
    cy.getByDataTestSubj('manageSpaces').should('exist').click({ force: true });
    cy.getByDataTestSubj('createSpace').click();
  }

  static openSolutionViewDropdown() {
    cy.get('[data-test-subj=solutionViewSelect]').click();
  }

  static verifySolutionViewSecurityOptionIsHidden() {
    cy.get('[data-test-subj=solutionViewSecurityOption]').should('not.be.visible');
  }

  static verifySolutionViewOptionsAreVisible(...testSubjs: string[]) {
    testSubjs.forEach(subj => cy.get(`[data-test-subj="${subj}"]`).should('be.visible'));
  }

  static openSpace(spaceName: string) {
    cy.log('Open space');
    cy.getByDataTestSubj('spacesNavSelector').click();
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.getByDataTestSubj(`${spaceName}-selectableSpaceItem`).click();
    } else {
      cy.getByDataTestSubj(`${spaceName}-gotoSpace`).click();
    }
  }

  static verifyCurrentSpace(spaceName: string) {
    cy.log('Verify current space');
    if (semver.gte(getKibanaVersion(), '9.0.0')) {
      cy.getByDataTestSubj(`space-avatar-${spaceName}`).should('be.visible');
    } else if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.getByDataTestSubj(`space-avatar-${spaceName}`).should('exist');
    } else {
      cy.getByDataTestSubj(`space-avatar-${spaceName}`).should('be.visible');
    }
  }
}
