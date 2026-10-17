import { kibanaVersion } from '../helpers';
import { Popover } from './Popover';

export class ManageSpaces {
  static openSpacesNavSelector(openSelector = '[data-test-subj=manageSpaces]') {
    Popover.open('[data-test-subj=spacesNavSelector]', openSelector);
  }

  static openSpacesManagementPage() {
    ManageSpaces.openSpacesNavSelector();
    cy.getByDataTestSubj('manageSpaces').click();
    cy.location('pathname').should('contain', '/management/kibana/spaces');
    cy.getByDataTestSubj('spaces-grid-page').should('exist');
  }

  static openEditSpacePage(spaceId: string, spaceName: string) {
    ManageSpaces.openSpacesManagementPage();
    if (kibanaVersion.gte('8.16.0')) {
      cy.getByDataTestSubj(`${spaceId}-hyperlink`).click();
    } else {
      // The closing spaces popover also lists the space by name, so the lookup stays in the grid.
      cy.getByDataTestSubj('spaces-grid-page').contains('a', spaceName).click();
    }
    cy.location('pathname').should('contain', `/management/kibana/spaces/edit/${spaceId}`);
  }
}
