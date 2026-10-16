// The table of saved objects that an app lists: dashboards, Canvas workpads, data views. It is the
// only table of its page, with a header row first and one link in each row.
export class SavedObjectsListTable {
  /**
   * Clicks the link of a row of the table. Row 0 of the role query is the header row.
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
