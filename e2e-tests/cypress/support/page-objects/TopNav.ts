import { shouldNotBeShown } from '../helpers/hiddenByCss';

const OVERFLOW_BUTTON = '[data-test-subj="app-menu-overflow-button"]';
const OVERFLOW_POPOVER = '[data-test-subj="app-menu-popover"]';

export class TopNav {
  // The anchor proves that the top menu is rendered. Kibana 9.4 and later moves the menu items over
  // its limit into a popover that renders only while it is open, so the check opens it when it exists.
  // A control that Kibana does not render also passes the check, so `inPage` names the controls that
  // Kibana renders and ROR hides: those must exist, and a renamed test subject fails the check.
  static verifyControlsNotShown(
    anchorTestSubj: string,
    testSubjects: string[],
    { overflowAnchorTestSubj, inPage = [] }: { overflowAnchorTestSubj?: string; inPage?: string[] } = {}
  ) {
    cy.getByDataTestSubj(anchorTestSubj).should('be.visible');
    cy.get('body').then($body => {
      const hasOverflow = $body.find(OVERFLOW_BUTTON).length > 0;
      if (hasOverflow) {
        cy.get(OVERFLOW_BUTTON).click();
        cy.get(OVERFLOW_POPOVER).should('be.visible');
        if (overflowAnchorTestSubj) {
          cy.get(OVERFLOW_POPOVER).find(`[data-test-subj="${overflowAnchorTestSubj}"]`).should('exist');
        }
      }
      cy.get('body').should($body => {
        inPage.forEach(testSubj => {
          expect($body.find(`[data-test-subj="${testSubj}"]`).length, `${testSubj} in the page`).to.be.greaterThan(0);
        });
      });
      testSubjects.forEach(testSubj => shouldNotBeShown(`[data-test-subj="${testSubj}"]`));
      if (hasOverflow) {
        cy.get(OVERFLOW_BUTTON).click();
        cy.get(OVERFLOW_POPOVER).should('not.exist');
      }
    });
  }

  static verifyOverflowButtonExists() {
    cy.get(OVERFLOW_BUTTON).should('exist');
  }
}
