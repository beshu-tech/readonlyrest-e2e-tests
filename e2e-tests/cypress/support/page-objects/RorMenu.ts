import { Loader } from './Loader';

export class RorMenu {
  private static readonly TRIGGER = '#rorMenuPopover';
  private static readonly PANEL = '#rorMenuPanel';

  static openRorMenu() {
    RorMenu.clickTriggerUntilOpen();
    cy.get(RorMenu.PANEL, { timeout: 10000 }).should('exist');
  }

  static closeRorMenu() {
    cy.get(RorMenu.TRIGGER).click();
  }

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

  private static clickTriggerUntilOpen(attempt = 1): Cypress.Chainable {
    return cy
      .get(RorMenu.TRIGGER, { timeout: 30000 })
      .click()
      .wait(300, { log: false })
      .get('body', { log: false })
      .then($body => {
        if ($body.find(RorMenu.PANEL).length === 0 && attempt < 3) {
          return RorMenu.clickTriggerUntilOpen(attempt + 1);
        }
        return $body;
      });
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
