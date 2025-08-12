import { KibanaNavigation } from './KibanaNavigation';

export class StackManagement {
  static openReportingPage() {
    KibanaNavigation.openPage('Stack Management');
    cy.contains('Reporting').click();
  }

  static openSavedObjectsPage() {
    cy.log('open saved objects page');
    KibanaNavigation.openPage('Stack Management');
    cy.contains('Saved Objects').click();
  }

  static openAlertsPage() {
    cy.log('open alerts page');
    KibanaNavigation.openPage('Stack Management');
    KibanaNavigation.openSubPage('Alerts');
  }

  static openRulesPage() {
    cy.log('open rules page');
    KibanaNavigation.openPage('Stack Management');
    KibanaNavigation.openSubPage('Rules');
  }

  static openConnectorsPage() {
    cy.log('open connectors page');
    KibanaNavigation.openPage('Stack Management');
    KibanaNavigation.openSubPage('Connectors');
  }

  static openRulesAndConnectorsPage() {
    cy.log('open rules and connectors page');
    KibanaNavigation.openPage('Stack Management');
    KibanaNavigation.openSubPage('Rules and Connectors');
  }
}
