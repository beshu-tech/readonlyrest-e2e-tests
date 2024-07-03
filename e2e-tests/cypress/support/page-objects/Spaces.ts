export class Spaces {
  static removeSpace(spaceName: string) {
    cy.log('Remove space');

    cy.get('[data-test-subj=spacesNavSelector]').click();
    cy.get('[data-test-subj=manageSpaces]').click({ force: true });
    cy.get(`[data-test-subj="${spaceName} space-deleteSpace"]`).click({ force: true });
    cy.get('[data-test-subj=confirmModalConfirmButton]').click({ force: true });
  }
}
