import * as semver from 'semver';
import { getKibanaVersion } from '../helpers';
import { interceptNext } from '../helpers/interceptNext';
import { ManageSpaces } from './ManageSpaces';

export class Spaces {
  static removeSpace(spaceName: string) {
    cy.log('Remove space');
    const spaceNameLowerCaseAndDash = spaceName.toLowerCase().replace(' ', '-');
    const deleteSpace = interceptNext('DELETE', `**/api/spaces/space/${spaceNameLowerCaseAndDash}`, 'deleteSpace');

    ManageSpaces.openSpacesManagementPage();
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      cy.get(`[id="${spaceNameLowerCaseAndDash}-actions"]`).click();
      cy.get(`[data-test-subj="${spaceNameLowerCaseAndDash}-deleteSpace"]`).click();
    } else {
      cy.get(`[data-test-subj="${spaceName}-deleteSpace"]`).click();
    }

    cy.get('[data-test-subj=confirmModalConfirmButton]').should('not.be.disabled').click();
    cy.waitForResponse(deleteSpace).then(response => {
      expect([204]).to.include(response.statusCode);
    });
  }

  /**
   * Saves a change to the features of the current space. Kibana asks to confirm it, sends the
   * update, goes back to the spaces list and then reloads the page. The URL is already that of the
   * spaces list before the reload, so this waits for the reload to end before the next step.
   */
  static saveCurrentSpaceFeatures() {
    const reloadMarker = 'rorE2eBeforeSpaceReload';
    const updateSpace = interceptNext('PUT', '**/api/spaces/space/*', 'updateSpace');
    cy.window().then(win => {
      Object.assign(win, { [reloadMarker]: true });
    });
    cy.get('[data-test-subj=save-space-button]').should('not.be.disabled').click();
    cy.get('[data-test-subj=confirmModalConfirmButton]').should('not.be.disabled').click();
    cy.waitForResponse(updateSpace).then(response => {
      expect(response.statusCode).to.eq(200);
    });
    cy.window().should('not.have.property', reloadMarker);
    cy.getByDataTestSubj('spaces-grid-page').should('exist');
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
    ManageSpaces.openSpacesManagementPage();
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

  static openSpace(spaceId: string) {
    cy.log('Open space');
    const spaceItem = semver.gte(getKibanaVersion(), '8.0.0')
      ? `[data-test-subj="${spaceId}-selectableSpaceItem"]`
      : `[data-test-subj="${spaceId}-gotoSpace"]`;
    ManageSpaces.openSpacesNavSelector(spaceItem);
    cy.get(spaceItem).click();
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
