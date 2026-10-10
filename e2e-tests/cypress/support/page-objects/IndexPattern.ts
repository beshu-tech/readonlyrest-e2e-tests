import { kibanaVersion } from '../helpers';
import { shouldNotBeShown } from '../helpers/hiddenByCss';
import { ListingTable } from './ListingTable';

export class IndexPattern {
  static openItem(number: number) {
    cy.log('Open index pattern item');
    ListingTable.openItem(number);
  }

  // The title proves that the header with the delete control is rendered. Kibana 9.4 and later puts
  // the delete action in the "More actions" menu of the header.
  static deleteIndexPatternButtonHidden() {
    cy.log('Delete Index pattern button hidden');
    cy.getByDataTestSubj('indexPatternTitle').should('be.visible');
    shouldNotBeShown('[data-test-subj="deleteIndexPatternButton"]');
    if (kibanaVersion.gte('9.4.0')) {
      shouldNotBeShown('[data-test-subj="moreActionsButton"]');
    }
  }

  // The table proves that the list page is rendered. Kibana 8.0 renames index patterns to data views.
  static createButtonHidden() {
    cy.log('Create index pattern button hidden');
    cy.getByDataTestSubj('indexPatternTable').should('be.visible');
    if (kibanaVersion.gte('8.0.0')) {
      shouldNotBeShown('[data-test-subj="createDataViewButton"]');
    } else {
      shouldNotBeShown('[data-test-subj="createIndexPatternButton"]');
    }
  }

  static addIndexButtonHidden() {
    cy.log('Add index button hidden');
    if (kibanaVersion.gte('7.17.15')) {
      cy.get('[data-test-subj=addField]').should('not.exist');
    } else {
      cy.get('[data-test-subj=addField]').should('not.be.visible');
    }
  }

  static rowEditItemButtonsHidden() {
    cy.log('Row edit item buttons hidden');
    cy.findAllByRole('button', {
      name: /edit/i
    }).should('have.length', 0);
  }
}
