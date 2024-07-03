import { Loader } from './Loader';

export class RorMenu {

  static openRorMenu() {
    cy.get('#rorMenuPopover').click();
  }

  static closeRorMenu() {
    cy.get('#rorMenuPopover').click();
  }

  static openEditSecuritySettings() {
    cy.intercept('GET', '/pkp/api/settings').as('getSettings');
    cy.contains('Edit security settings').click({ force: true });
    cy.wait('@getSettings').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
    });
  }

  static changeTenancy(tenancyName: string, finishUrl?: string) {
    cy.log('changeTenancy');
    RorMenu.openRorMenu();
    cy.get('.ror_change_tenancy', { timeout: 30000 }).should('be.visible');
    cy.contains('Change tenancy').click({ force: true });
    cy.contains(tenancyName, { matchCase: false }).click({ force: true });
    Loader.loading(finishUrl);
  }

  static openReportingPage() {
    cy.log('open reporting page');
    RorMenu.openRorMenu();
    cy.contains('Manage kibana').click({ force: true });
    cy.get('.euiButtonEmpty').contains('Reporting').click({ force: true });
  }

  static openDataViewsPage() {
    cy.log('open data views page');
    cy.get('#rorMenuPopover').click();
    cy.get('.ror_kibana_management').click({ force: true });
    cy.get('.euiButtonEmpty').contains('Data View', { matchCase: false }).click({ force: true });
  }

  static pressLogoutButton() {
    cy.contains('Log out').click();
  }
}
