import { recurse } from 'cypress-recurse';
import { shouldNotBeShown } from '../helpers/hiddenByCss';

const OVERFLOW_BUTTON = '[data-test-subj="app-menu-overflow-button"]';
const OVERFLOW_POPOVER = '[data-test-subj="app-menu-popover"]';
const REQUEST_IN_FLIGHT = '[data-test-subj=globalLoadingIndicator]';
const PANEL_RENDERING = '[data-render-complete="false"]';
const QUIET_MS = 1500;

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
        TopNav.waitForPageQuiet();
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
        TopNav.waitForPageQuiet();
        cy.get(OVERFLOW_BUTTON).click();
        cy.get(OVERFLOW_POPOVER).should('not.exist');
      }
    });
  }

  // Kibana 9.4 throws React error #185 (maximum update depth) and blanks the page when the page updates
  // while its overflow menu is open (RORDEV-2323). A dashboard can load its panels a second time after
  // they first rendered. So the menu opens and closes only after QUIET_MS with no request in flight
  // and no panel that renders.
  private static waitForPageQuiet() {
    let quietSince = Date.now();
    recurse(
      () => cy.get('body', { log: false }),
      $body => {
        if ($body.find(REQUEST_IN_FLIGHT).length > 0 || $body.find(PANEL_RENDERING).length > 0) {
          quietSince = Date.now();
        }
        return Date.now() - quietSince >= QUIET_MS;
      },
      { delay: 100, limit: 600, timeout: 60000, log: false, error: 'The page did not stop loading' }
    );
  }

  static verifyOverflowButtonExists() {
    cy.get(OVERFLOW_BUTTON).should('exist');
  }
}
