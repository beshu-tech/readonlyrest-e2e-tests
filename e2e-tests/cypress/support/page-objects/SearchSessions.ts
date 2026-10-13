export class SearchSessions {
  static numberOfVisibleSearchSessions(numberOfVisibleSessions: number) {
    cy.log('Verify list of search sessions');

    cy.getByDataTestSubj('searchSessionsRow').should('have.length', numberOfVisibleSessions);
  }

  static openSelectedSearchSession(sessionRow: number) {
    cy.log('Open selected search session from the list');

    cy.getByDataTestSubj('searchSessionsRow').eq(sessionRow).as('row');
    cy.get('@row').findByDataTestSubj('sessionManagementNameCol').click();
  }
}
