export class Canvas {
  static openItem(number) {
    cy.findAllByRole('row')
      .eq(number + 1)
      .within(() => {
        cy.findByRole('link').click();
      });
  }

  static addElementButtonNotExist() {
    cy.log('Add element button not exist');

    cy.findByText(/add element/i).should('not.exist');
  }

  static editButtonNotExist() {
    cy.log('Edit button not exist');
    cy.get('[data-test-subj=save-space-button]').should('not.exist');
  }

  static workPadSettingsNotExist() {
    cy.log('Work pad settings not exist');

    cy.findByRole('heading', {
      name: /workpad settings/i
    }).should('not.exist');
  }
}
