export class Dashboard {
  static openItem(number) {
    cy.findAllByRole('row')
      .eq(number + 1)
      .within(() => {
        cy.findByRole('link').click();
      });
  }

  static editButtonNotExist() {
    cy.log('Edit button Not exist');
    cy.findByText(/edit/i).should('not.exist');
  }

  static cloneButtonNotExist() {
    cy.log('Clone button Not exist');
    cy.findByText(/clone/i).should('not.exist');
  }
}
