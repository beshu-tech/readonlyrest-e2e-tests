import * as semver from 'semver';
import { getKibanaVersion } from '../helpers';

export class IndexPattern {
  static openItem(number) {
    cy.log('Open index pattern item');
    cy.findAllByRole('row')
      .eq(number + 1)
      .within(() => {
        cy.findByRole('link').click();
      });
  }

  static deleteIndexPatternButtonHidden() {
    cy.log('Delete Index pattern button hidden');
    cy.findByRole('button', { name: /delete index pattern\./i }).should('not.exist');
  }

  static addIndexButtonHidden() {
    cy.log('Add index button hidden');
    if (semver.gte(getKibanaVersion(), '7.17.15')) {
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
