import { recurse } from 'cypress-recurse';

export class Popover {
  // A popover opens in well under a second. After this time with no panel, the click is lost.
  private static readonly RECLICK_AFTER_MS = 3000;

  private static readonly MAX_CLICKS = 3;

  /**
   * Clicks a trigger that toggles a popover, and waits until `openSelector` is in the DOM.
   *
   * A click can land while the header re-renders, and then the popover stays shut. A second click
   * at a fixed time is not safe: if the first click opened the popover, the second click closes it.
   * So this clicks again only when `openSelector` is still absent 3 s after the last click, and the
   * trigger does not have aria-expanded="true".
   */
  static open(trigger: string, openSelector: string): Cypress.Chainable<JQuery<HTMLElement>> {
    let clicks = 0;
    let lastClickAt = 0;

    const isOpen = ($body: JQuery<HTMLElement>) => $body.find(openSelector).length > 0;
    const isExpanded = ($body: JQuery<HTMLElement>) => {
      const $trigger = $body.find(trigger);
      return $trigger.filter('[aria-expanded="true"]').length + $trigger.find('[aria-expanded="true"]').length > 0;
    };
    const lastClickIsOld = () => Date.now() - lastClickAt >= Popover.RECLICK_AFTER_MS;

    recurse(
      () =>
        cy
          .get('body', { log: false })
          .then($body => {
            const clickNeeded = clicks === 0 || (lastClickIsOld() && !isExpanded($body));
            if (!isOpen($body) && clickNeeded && clicks < Popover.MAX_CLICKS) {
              clicks += 1;
              cy.get(trigger, { timeout: 30000 })
                .click()
                .then(() => {
                  lastClickAt = Date.now();
                });
            }
          })
          .then(() => cy.get('body', { log: false })),
      $body => isOpen($body) || (clicks >= Popover.MAX_CLICKS && lastClickIsOld()),
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
