import { recurse } from 'cypress-recurse';

// A popover opens in well under a second. After this time with no popover, a click is lost.
const RECLICK_AFTER_MS = 3000;

// A click on a trigger that toggles a popover is lost when no popover opened this long after it.
export const clickIsOld = (clickedAt: number) => Date.now() - clickedAt >= RECLICK_AFTER_MS;

export class Popover {
  private static readonly MAX_CLICKS = 3;

  /**
   * Clicks a trigger that toggles a popover, and waits until `openSelector` is in the DOM.
   *
   * The trigger toggles, so a second click at a fixed time can close a popover that the first click
   * opened. A new click comes only when the last one was lost.
   */
  static open(trigger: string, openSelector: string): Cypress.Chainable<JQuery<HTMLElement>> {
    let clicks = 0;
    let lastClickAt = 0;

    const isOpen = ($body: JQuery<HTMLElement>) => $body.find(openSelector).length > 0;
    const isExpanded = ($body: JQuery<HTMLElement>) => {
      const $trigger = $body.find(trigger);
      return $trigger.filter('[aria-expanded="true"]').length + $trigger.find('[aria-expanded="true"]').length > 0;
    };
    const isFirstClick = () => clicks === 0;
    const lastClickWasLost = ($body: JQuery<HTMLElement>) => clickIsOld(lastClickAt) && !isExpanded($body);
    const canClickAgain = () => clicks < Popover.MAX_CLICKS;
    const gaveUp = () => !canClickAgain() && clickIsOld(lastClickAt);

    recurse(
      () =>
        cy
          .get('body', { log: false })
          .then($body => {
            if (isOpen($body)) {
              return;
            }
            if (isFirstClick() || (lastClickWasLost($body) && canClickAgain())) {
              clicks += 1;
              cy.get(trigger, { timeout: 30000 })
                .click()
                .then(() => {
                  lastClickAt = Date.now();
                });
            }
          })
          .then(() => cy.get('body', { log: false })),
      $body => isOpen($body) || gaveUp(),
      {
        delay: 100,
        timeout: 60000,
        // The assertion below gives the clearer message: it names the selector that never appeared.
        doNotFail: true,
        log: false
      }
    );

    return cy.get(openSelector).should('exist');
  }
}
