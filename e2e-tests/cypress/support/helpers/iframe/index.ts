// An empty body is the document of an iframe that has not loaded yet.
export const getIframeBody = (selector: string) =>
  cy.get(selector).its('0.contentDocument.body').should('not.be.empty').then(cy.wrap);
