import * as semver from 'semver';
import { getKibanaVersion } from '../helpers';

export class Spaces {
  static removeSpace(spaceName: string) {
    cy.log('Remove space');

    cy.get('[data-test-subj=spacesNavSelector]').click();
    cy.get('[data-test-subj=manageSpaces]').click({ force: true });
    if (semver.gte(getKibanaVersion(), '8.16.0')) {
      spaceName = spaceName.toLowerCase();
      cy.get(`[id="${spaceName}-space-actions"]`).click();
    }

    cy.get(`[data-test-subj="${spaceName}-space-deleteSpace"]`).click();
    cy.get('[data-test-subj=confirmModalConfirmButton]').click({ force: true });
    cy.contains(`Deleted space '${spaceName}'`);
  }
}
