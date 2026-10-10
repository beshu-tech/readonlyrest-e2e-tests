import { shouldNotBeShown } from '../helpers/hiddenByCss';

export class Canvas {
  static openItem(number: number) {
    cy.findAllByRole('row')
      .eq(number + 1)
      .within(() => {
        cy.findByRole('link').click();
      });
  }

  // The refresh control shows for every user, so it proves that the workpad header is rendered.
  // Kibana 7.x renders the Edit menu for a read-only user too, and ROR hides it with CSS.
  static writeControlsNotShown() {
    cy.log('Canvas write controls not shown');
    cy.getByDataTestSubj('canvas-refresh-control').should('be.visible');
    shouldNotBeShown('[data-test-subj="canvasWorkpadEditMenuButton"]');
    shouldNotBeShown('[data-test-subj="add-element-button"]');
    cy.findByRole('heading', { name: /workpad settings/i }).should('not.exist');
  }
}
