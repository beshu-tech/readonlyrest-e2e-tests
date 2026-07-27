import { Loader } from './Loader';
import semver from 'semver';
import { getKibanaVersion } from '../helpers';

export class RorMenu {
  // Click the RorPopover wrapper, not the inner <button className="ror-menu-trigger">. Targeting
  // the button looks more correct — it is what actually carries onClick — but Cypress does not
  // consider it visible on 9.3/9.4 (it is present in the DOM and every 9.x leg failed
  // `expected '<button.ror-menu-trigger>' to be 'visible'`, while 8.19/7.17 passed). Clicking the
  // wrapper lets the event bubble to the button and is what every version has always used.
  private static readonly TRIGGER = '#rorMenuPopover';

  // rorPopover.tsx passes panelProps={{ id: panelId }} and EuiPopover only mounts the panel while
  // open, so the panel's presence is an exact "the menu is open" signal.
  private static readonly PANEL = '#rorMenuPanel';

  private static readonly SETTLE_MS = 300;
  private static readonly OPEN_ATTEMPTS = 3;

  static openRorMenu() {
    cy.log('open ROR menu');
    RorMenu.clickTriggerUntilOpen(RorMenu.OPEN_ATTEMPTS);
    // After the retries, assert properly so a genuine failure reports "#rorMenuPanel not found"
    // rather than surfacing later as a confusing "'Edit security settings' never appeared".
    // `exist`, not `be.visible`: the panel is only mounted while the popover is open, so existence
    // is already the exact signal — and asserting visibility is precisely the mistake that broke
    // 9.x above. Nothing here should depend on Cypress's visibility heuristics.
    cy.get(RorMenu.PANEL, { timeout: 10000 }).should('exist');
  }

  static closeRorMenu() {
    cy.log('close ROR menu');
    cy.get(RorMenu.TRIGGER).click();
    cy.get(RorMenu.PANEL).should('not.exist');
  }

  /**
   * Clicks the trigger and re-clicks if the popover did not open. Cypress cannot catch a failed
   * assertion, so the panel is polled from the DOM directly after a short settle — that leaves us
   * free to retry the click, which `cy.get(...).should(...)` alone can never do because Cypress
   * retries assertions but never re-runs the action that preceded them.
   */
  private static clickTriggerUntilOpen(attemptsLeft: number) {
    // No `.should('be.visible')` here: cy.click() enforces actionability itself, and asserting it
    // separately is what broke every 9.x leg.
    cy.get(RorMenu.TRIGGER, { timeout: 30000 }).click();
    cy.wait(RorMenu.SETTLE_MS, { log: false });

    cy.get('body', { log: false }).then($body => {
      if ($body.find(RorMenu.PANEL).length > 0 || attemptsLeft <= 1) {
        return;
      }
      cy.log(`ROR menu did not open — re-clicking (${attemptsLeft - 1} attempt(s) left)`);
      RorMenu.clickTriggerUntilOpen(attemptsLeft - 1);
    });
  }

  // Every caller opens the menu immediately before this, so the lookup is scoped to the panel:
  // an unscoped cy.contains() would happily retry for 20s against a closed menu and then report
  // "'Edit security settings' never appeared", hiding the fact that the click never landed.
  static openEditSecuritySettings() {
    cy.intercept('GET', '/pkp/api/settings').as('getSettings');
    cy.get(RorMenu.PANEL).contains('Edit security settings').click({ force: true });
    cy.wait('@getSettings').then(({ response }) => {
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
