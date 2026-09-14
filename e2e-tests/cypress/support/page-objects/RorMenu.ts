import { recurse } from 'cypress-recurse';
import { Loader } from './Loader';

export class RorMenu {
  // The RorPopover wrapper, not the inner <button className="ror-menu-trigger"> that carries the
  // onClick. Cypress does not consider that button visible on Kibana 9.x, so clicking it fails
  // actionability there; clicking the wrapper lets the event bubble and works on every version.
  private static readonly TRIGGER = '#rorMenuPopover';

  // rorPopover.tsx passes panelProps={{ id: panelId }} and EuiPopover only mounts the panel while
  // open, so the panel's presence is an exact "the menu is open" signal.
  private static readonly PANEL = '#rorMenuPanel';

  private static readonly SETTLE_MS = 300;
  private static readonly OPEN_ATTEMPTS = 3;

  static openRorMenu() {
    cy.log('open ROR menu');
    RorMenu.clickTriggerUntilOpen();
    // Assert after the retries so a real failure reports "#rorMenuPanel not found" instead of a
    // later, more confusing "'Edit security settings' never appeared". `exist`, not `be.visible`:
    // the panel is only mounted while the popover is open, so existence is the exact signal.
    cy.get(RorMenu.PANEL, { timeout: 10000 }).should('exist');
  }

  static closeRorMenu() {
    cy.log('close ROR menu');
    cy.get(RorMenu.TRIGGER).click();
    cy.get(RorMenu.PANEL).should('not.exist');
  }

  /**
   * Clicks the trigger and re-clicks if the popover did not open.
   *
   * The panel is polled from the DOM rather than asserted on, because `cy.get(...).should(...)`
   * retries the assertion but never re-runs the click before it, so a swallowed click can only be
   * recovered by driving the retry ourselves.
   */
  private static clickTriggerUntilOpen() {
    recurse(
      () =>
        // No `.should('be.visible')`: cy.click() enforces actionability itself, and asserting
        // visibility separately fails on Kibana 9.x. The settle wait belongs here rather than in
        // `delay` so the panel gets a chance to mount before the first check, not only between
        // attempts.
        cy
          .get(RorMenu.TRIGGER, { timeout: 30000 })
          .click()
          .then(() => cy.wait(RorMenu.SETTLE_MS, { log: false }))
          .then(() => cy.get('body', { log: false })),
      $body => $body.find(RorMenu.PANEL).length > 0,
      {
        limit: RorMenu.OPEN_ATTEMPTS,
        delay: 0,
        timeout: 120000,
        // openRorMenu() asserts on the panel immediately after, so failing here would only replace
        // that message with a less specific one.
        doNotFail: true,
        log: false
      }
    );
  }

  // Every caller opens the menu immediately before this, so the lookup is scoped to the panel. An
  // unscoped cy.contains() would retry for 20s against a closed menu and report the item as
  // missing, hiding the fact that the menu never opened.
  static openEditSecuritySettings() {
    cy.intercept('GET', '/pkp/api/settings').as('getSettings');
    cy.get(RorMenu.PANEL).contains('Edit security settings').click({ force: true });
    cy.waitForResponse('@getSettings').then(response => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static changeTenancy(tenancyName: string, finishUrl?: string, spacePrefix?: string) {
    cy.log('changeTenancy');
    RorMenu.openRorMenu();
    cy.get('.ror_change_tenancy', { timeout: 30000 }).should('be.visible');
    cy.contains('Change tenancy').click({ force: true });
    cy.contains(tenancyName, { matchCase: false }).click({ force: true });
    Loader.loading(finishUrl, spacePrefix);
  }

  static openReportingPage() {
    cy.log('open reporting page');
    RorMenu.openRorMenu();
    cy.contains('Manage kibana').click({ force: true });
    cy.contains('button', 'Reporting').click({ force: true });
  }

  static openDataViewsPage() {
    cy.log('open data views page');
    RorMenu.openRorMenu();
    cy.get('.ror_kibana_management').click({ force: true });
    cy.get('.euiButtonEmpty').contains('Data View', { matchCase: false }).click({ force: true });
  }

  static pressLogoutButton() {
    cy.contains('Log out').click();
  }

  static verifyCurrentTenant(tenancyName: string) {
    cy.log('Verify current tenant');

    cy.get('[data-testid="current-tenant"]').contains(tenancyName).should('be.visible');
  }

  static verifyNoTenantAvailable() {
    cy.log('Verify no tenant available');

    cy.get('[data-testid="current-tenant"]').should('not.exist');
  }
}
