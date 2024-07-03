import { KibanaNavigation } from './KibanaNavigation';

export class StackManagement {
  static openReportingPage() {
    KibanaNavigation.openPage('Stack Management');
    cy.contains('Reporting').click();
  }

  static openSavedObjectsPage() {
    cy.log('open saved objects page');
    KibanaNavigation.openKibanaNavigation();
    KibanaNavigation.openPage('Stack Management');
    cy.contains('Saved Objects').click();
  }
}
