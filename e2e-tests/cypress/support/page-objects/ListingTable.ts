export class ListingTable {
  /**
   * Clicks the link of a row of the listing table. Row 0 of the role query is the header row.
   *
   * One query chain from the page root: while the table loads, Kibana renders its rows again, and a
   * retry then looks up the row again. A `.within()` on the row keeps the first, detached row.
   */
  static openItem(index: number) {
    cy.findAllByRole('row')
      .eq(index + 1)
      .findByRole('link')
      .click();
  }
}
