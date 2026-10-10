// ROR hides a control with injected CSS: display none on the control or on a parent of it. Cypress
// "not visible" is no proof of that, because it is also true for an element below the scroll area.
export function isHiddenByCss($element: JQuery<HTMLElement>) {
  const hiddenElements = $element
    .parents()
    .addBack()
    .filter((_, element) => Cypress.$(element).css('display') === 'none');
  return hiddenElements.length > 0;
}

// Passes when no element matches, or when ROR hides each match with CSS. Prove first that the page
// part that holds the control is rendered, or the check passes before the control comes.
export function shouldNotBeShown(selector: string) {
  cy.get('body').should($body => {
    $body.find(selector).each((_, element) => {
      expect(isHiddenByCss(Cypress.$(element)), `${selector} hidden`).to.equal(true);
    });
  });
}
