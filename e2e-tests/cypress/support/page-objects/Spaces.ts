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
    cy.wait('@deleteSpace').then(({ response }) => {
      expect([204]).to.include(response.statusCode);
    });
  }
}
