export class SearchApps {
  static openSearchAppsDropdown() {
    cy.log('Open search apps dropdown');

    cy.getByDataTestSubj('nav-search-input').focus();
  }

  static verifyAppsInSearchResults(appNames: string[]) {
    cy.log('Verify apps in search results');

    cy.getByDataTestSubj('nav-search-option').should('have.length', appNames.length);

    appNames.forEach((appName, index) => {
      cy.getByDataTestSubj('nav-search-option').eq(index).contains(appName);
    });
  }

  static searchApp(appName: string) {
    cy.log('Search app');

    cy.getByDataTestSubj('nav-search-input').clear();
    cy.getByDataTestSubj('nav-search-input').type(appName);
  }

  static noResultsFound() {
    cy.log('no results found');

    cy.getByDataTestSubj('nav-search-no-results').should('be.visible');
  }
}
