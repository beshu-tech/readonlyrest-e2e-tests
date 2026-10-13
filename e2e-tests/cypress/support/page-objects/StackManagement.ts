import { KibanaNavigation } from './KibanaNavigation';

export class StackManagement {
  // Opens a page of the Stack Management navigation. A search in the whole page can also find a
  // landing card, a breadcrumb or a toast with the same text.
  static openPage(page: string) {
    cy.log(`open Stack Management page ${page}`);
    cy.get('[data-test-subj=mgtSideBarNav]').findByRole('link', { name: page }).click();
  }

  static openReportingPage() {
    KibanaNavigation.openPage('Stack Management');
    StackManagement.openPage('Reporting');
  }

  static openSavedObjectsPage() {
    cy.log('open saved objects page');
    KibanaNavigation.openPage('Stack Management');
    StackManagement.openPage('Saved Objects');
  }

  static openAlertsPage() {
    cy.log('open alerts page');
    KibanaNavigation.openPage('Stack Management');
    StackManagement.openPage('Alerts');
  }

  static openRulesPage() {
    cy.log('open rules page');
    KibanaNavigation.openPage('Stack Management');
    StackManagement.openPage('Rules');
  }

  static openConnectorsPage() {
    cy.log('open connectors page');
    KibanaNavigation.openPage('Stack Management');
    StackManagement.openPage('Connectors');
  }

  static openRulesAndConnectorsPage() {
    cy.log('open rules and connectors page');
    KibanaNavigation.openPage('Stack Management');
    StackManagement.openPage('Rules and Connectors');
  }
}
