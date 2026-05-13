import * as semver from 'semver';
import { getKibanaVersion } from '../helpers';

export class ManageSpaces {
  static openSpaceViaNavSelector(spaceName: string) {
    cy.get('[data-test-subj=spacesNavSelector]').click();
    ManageSpaces.getManageButtonInNavSelector().should('be.visible').click();
    cy.contains(spaceName).click();
  }

  static getManageButtonInNavSelector() {
    if (semver.gte(getKibanaVersion(), '9.4.0')) {
      return cy.getByDataTestSubj('manageSpaces');
    }

    return cy.contains('Manage spaces');
  }
}
