import { Loader } from './Loader';
import semver from 'semver';
import { getKibanaVersion } from '../helpers';

export class RorMenu {
  // `#rorMenuPopover` is the RorPopover WRAPPER, not the clickable element: rorMenu.tsx renders the
  // trigger as <button className="ror-menu-trigger"> inside it, and the wrapper also holds the
  // tenant badge. Clicking the wrapper relies on Cypress's centre point happening to land on the
  // button, and the badge shifts that centre depending on hover/tenant state — which is how a click
  // gets silently swallowed and every later menu lookup times out instead.
  private static readonly TRIGGER = '.ror-menu-trigger';

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
    cy.get(RorMenu.PANEL, { timeout: 10000 }).should('be.visible');
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
    cy.get(RorMenu.TRIGGER, { timeout: 30000 }).should('be.visible').click();
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
