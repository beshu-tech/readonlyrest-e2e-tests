export class PageNotFound {
  public static visible() {
    return cy.contains('Page not found').should('be.visible');
  }

  public static goToDefaultRoute() {
    cy.log('Go to default route from Page not found');
    cy.get('button').contains('Go to default route').click();
  }
}
