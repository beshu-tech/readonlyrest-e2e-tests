export class Loader {
  public static loading(finishUrl?: string) {
    cy.log('loading');
    this.start();
    this.finish(finishUrl);
  }

  private static start() {
    cy.log('loading start');
    cy.contains('Loading Elastic', { timeout: 80000 }).should('exist');
  }

  private static finish(finishUrl = '/app/home', spacePrefix = '/s/default') {
    cy.log('loading finish');
    cy.contains('Loading Elastic', { timeout: 80000 }).should('not.exist');
    cy.url().should('include', `${Cypress.config().baseUrl}${spacePrefix}${finishUrl}`);
    cy.get('[data-test-subj=globalLoadingIndicator-hidden]').should('be.visible');
  }
}
