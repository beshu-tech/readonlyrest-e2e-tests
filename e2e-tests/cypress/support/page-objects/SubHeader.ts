export class SubHeader {
  static readonlyBadgeVisible() {
    cy.log('Read-only badge visible');
    cy.get('[data-test-badge-label="Read only"]').should('be.visible');
  }

  static breadcrumbsLastItem(text: string) {
    cy.get('[data-test-subj="breadcrumb last"]').within(() => {
      cy.findByText(text);
    });
  }
}
