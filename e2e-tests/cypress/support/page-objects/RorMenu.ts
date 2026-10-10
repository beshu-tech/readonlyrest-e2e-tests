import { interceptNext } from '../helpers/interceptNext';
import { Loader } from './Loader';
import { expectSessionEnd } from '../sessionEnd';
import { Popover } from './Popover';

export class RorMenu {
  // The RorPopover wrapper, not the inner <button className="ror-menu-trigger"> that carries the
  // onClick. Cypress does not consider that button visible on Kibana 9.x, so clicking it fails
  // actionability there; clicking the wrapper lets the event bubble and works on every version.
  private static readonly TRIGGER = '#rorMenuPopover';

  // rorPopover.tsx passes panelProps={{ id: panelId }} and EuiPopover only mounts the panel while
  // open, so the panel's presence is an exact "the menu is open" signal.
  private static readonly PANEL = '#rorMenuPanel';

  // Change tenancy and Manage kibana each open their own popover, which EuiPopover mounts outside
  // #rorMenuPanel. The list of items in it carries this class, and mounts only while it is open.
  private static readonly SUB_MENU = '.ror-menu-scroll-container';

  static openRorMenu() {
    cy.log('open ROR menu');
    Popover.open(RorMenu.TRIGGER, RorMenu.PANEL);
  }

  static closeRorMenu() {
    cy.log('close ROR menu');
    cy.get(RorMenu.TRIGGER).click();
    cy.get(RorMenu.PANEL).should('not.exist');
  }

  // Every caller opens the menu before this. A lookup outside the panel can match the same text
  // elsewhere on the page, and a lookup in a closed menu reports the item as missing.
  static getPanel() {
    return cy.get(RorMenu.PANEL);
  }

  private static openSubMenu(trigger: string) {
    Popover.open(`${RorMenu.PANEL} ${trigger}`, RorMenu.SUB_MENU);
  }

  static openEditSecuritySettings() {
    const getSettings = interceptNext('getSettings', { method: 'GET', url: '/pkp/api/settings' });
    RorMenu.getPanel().contains('button', 'Edit security settings').click();
    cy.waitForResponse(getSettings).then(response => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static changeTenancy(tenancyName: string, finishUrl?: string) {
    cy.log('changeTenancy');
    RorMenu.openRorMenu();
    RorMenu.openSubMenu('.ror_change_tenancy');
    cy.get(RorMenu.SUB_MENU).contains(tenancyName, { matchCase: false }).click();
    Loader.loading(finishUrl);
  }

  static openReportingPage() {
    cy.log('open reporting page');
    RorMenu.openRorMenu();
    RorMenu.openSubMenu('.ror_kibana_management');
    cy.get(RorMenu.SUB_MENU).contains('button', 'Reporting').click();
  }

  static openDataViewsPage() {
    cy.log('open data views page');
    RorMenu.openRorMenu();
    RorMenu.openSubMenu('.ror_kibana_management');
    cy.get(RorMenu.SUB_MENU).contains('button', 'Data Views').click();
  }

  static pressLogoutButton() {
    expectSessionEnd();
    RorMenu.getPanel().contains('button', 'Log out').click();
  }

  static verifyCurrentTenant(tenancyName: string) {
    cy.log('Verify current tenant');

    cy.get('[data-testid="current-tenant"]').contains(tenancyName).should('be.visible');
  }

  // The menu shows no tenancy for a user without groups either, so the check proves something only for
  // a user with groups.
  static verifyNoTenantAvailable() {
    cy.log('Verify no tenant available');

    cy.get('[data-testid="current-tenant"]').should('not.exist');
  }

  // The ROR menu loads the identity of the page from /pkp/api/info when the page starts. Call this
  // before the page loads. The request goes without If-None-Match, so the answer has a body.
  static interceptIdentity() {
    cy.intercept({ method: 'GET', pathname: '/pkp/api/info' }, req => {
      delete req.headers['if-none-match'];
    }).as('rorIdentity');
  }

  // The menu shows no tenancy for a user without groups, so only the identity can show a stale one.
  static verifyIdentityTenancyIsNot(username: string, staleGroupId: string) {
    cy.log(`Verify that the tenancy of ${username} is not ${staleGroupId}`);

    cy.wait('@rorIdentity').then(({ response }) => {
      expect(response?.statusCode, 'GET /pkp/api/info status').to.equal(200);
      const identity = response?.body?.identity as { username?: string; currentGroup?: { id: string } } | undefined;
      expect(identity?.username, 'user of the page').to.equal(username);
      expect(identity?.currentGroup?.id, 'tenancy of the page').not.to.equal(staleGroupId);
    });
  }
}
