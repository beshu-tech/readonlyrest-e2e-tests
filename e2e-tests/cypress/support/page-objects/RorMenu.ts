import { recurse } from 'cypress-recurse';
import { interceptNext } from '../helpers/interceptNext';
import { Loader } from './Loader';
import { expectSessionEnd } from '../sessionEnd';
import { Popover } from './Popover';

export class RorMenu {
  // The RorPopover wrapper, not the inner <button className="ror-menu-trigger"> that carries the
  // onClick. Cypress does not consider that button visible on Kibana 9.x, so clicking it fails
  // actionability there; clicking the wrapper lets the event bubble and works on every version.
  private static readonly TRIGGER = '#rorMenuPopover';

  // The button in TRIGGER that carries the onClick. A DOM click needs the element of the handler.
  private static readonly TRIGGER_BUTTON = '#rorMenuPopover .ror-menu-trigger';

  // A popover opens in well under a second. After this time with no popover, the click is lost.
  private static readonly RECLICK_AFTER_MS = 3000;

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

  /**
   * Clicks the `selector` element with `text` in the menu panel, or with `subMenuTrigger` in the
   * sub-menu that this panel item opens.
   *
   * Kibana 9.5 can mount the ROR header control again while Kibana starts: a header control that
   * registers later goes before it, and Kibana lists the controls by index. That closes every ROR
   * popover. cy.click() then fails the test, because its element left the page and nothing opens the
   * menu again. So each check looks at the page as it is now: it clicks the item when the item is
   * there, and else opens what is closed. The clicks are DOM clicks on the elements of the check. A
   * trigger gets another click only 3 s after its last one: a click while its popover opens closes it.
   */
  static clickMenuItem(selector: string, text: string, subMenuTrigger?: string, matchCase = true) {
    cy.log(`ROR menu: click ${text}`);
    const lastClickAt: Record<string, number> = {};
    const clickTrigger = ($trigger: JQuery<HTMLElement>, name: string) => {
      if ($trigger.length > 0 && Date.now() - (lastClickAt[name] ?? 0) >= RorMenu.RECLICK_AFTER_MS) {
        $trigger[0].click();
        lastClickAt[name] = Date.now();
      }
    };
    let clicked = false;
    recurse(
      () =>
        cy.get('body', { log: false }).then($body => {
          const $item = RorMenu.findByText(
            $body.find(subMenuTrigger ? RorMenu.SUB_MENU : RorMenu.PANEL),
            selector,
            text,
            matchCase
          );
          const panelOpen = $body.find(RorMenu.PANEL).length > 0;
          if ($item.length > 0) {
            $item[0].click();
            clicked = true;
          } else if (!panelOpen) {
            clickTrigger($body.find(RorMenu.TRIGGER_BUTTON), 'menu');
          } else if (subMenuTrigger && $body.find(RorMenu.SUB_MENU).length === 0) {
            clickTrigger($body.find(`${RorMenu.PANEL} ${subMenuTrigger}`), 'subMenu');
          }
          return clicked;
        }),
      Boolean,
      { delay: 100, timeout: 60000, doNotFail: true, log: false }
    ).then(() => {
      expect(clicked, `ROR menu item "${text}" clicked`).to.equal(true);
    });
  }

  // The `selector` elements in the scope whose text has `text`, without such an element inside them.
  // The same element as cy.contains(selector, text) finds.
  private static findByText($scope: JQuery<HTMLElement>, selector: string, text: string, matchCase: boolean) {
    const normal = (value: string) => (matchCase ? value : value.toLowerCase());
    const hasText = (element: Element) => normal(element.textContent ?? '').includes(normal(text));
    return $scope
      .find(selector)
      .filter((_, element) => hasText(element) && !Cypress.$(element).find(selector).toArray().some(hasText));
  }

  static openEditSecuritySettings() {
    const getSettings = interceptNext('getSettings', { method: 'GET', url: '/pkp/api/settings' });
    RorMenu.clickMenuItem('button', 'Edit security settings');
    cy.waitForResponse(getSettings).then(response => {
      expect([200, 304]).to.include(response.statusCode);
    });
  }

  static changeTenancy(tenancyName: string, finishUrl?: string) {
    cy.log('changeTenancy');
    RorMenu.clickMenuItem('*', tenancyName, '.ror_change_tenancy', false);
    Loader.loading(finishUrl);
  }

  static openReportingPage() {
    cy.log('open reporting page');
    RorMenu.clickMenuItem('button', 'Reporting', '.ror_kibana_management');
  }

  static openDataViewsPage() {
    cy.log('open data views page');
    RorMenu.clickMenuItem('button', 'Data Views', '.ror_kibana_management');
  }

  static pressLogoutButton() {
    expectSessionEnd();
    RorMenu.clickMenuItem('button', 'Log out');
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
