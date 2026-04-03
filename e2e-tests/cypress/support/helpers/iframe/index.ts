export const getIframeBody = (selector: string) => {
  return cy.get(selector).its('0.contentDocument').should('exist').its('body').should('not.be.undefined').then(cy.wrap);
};
