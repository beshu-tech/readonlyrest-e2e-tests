import { Login } from '../support/page-objects/Login';
import { StackManagement } from '../support/page-objects/StackManagement';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { kibanaVersion, rorKbnReleaseBefore } from '../support/helpers';

// ROR KBN before 1.72.0 shows the overwrite on the Connectors page only when the page renders before
// Kibana redirects to .../connectors (RORDEV-2185). Remove the skip when no leg runs such a release.
const CONNECTORS_OVERWRITE_FIX = '1.72.0';

describe('Kibana-content-overwrite', () => {
  beforeEach(() => {
    Login.initialization();
  });

  it('should overwrite Kibana alerting content', () => {
    const isAlertingOverwritePageVisible = () => {
      if (kibanaVersion.gte('8.6.0')) {
        cy.contains(
          'Kibana alerting does not work with ReadonlyREST, but we are working on an even better alerting and reporting solution.'
        ).should('be.visible');
      } else {
        cy.contains(
          'Kibana alerting does not work with ReadonlyREST, but we are working on an even better alerting and reporting solution.'
        ).should('not.exist');
      }
    };

    if (kibanaVersion.gte('8.6.0')) {
      if (kibanaVersion.gte('8.14.0')) {
        StackManagement.openAlertsPage();
        isAlertingOverwritePageVisible();
        KibanaNavigation.openHomepage();
      }
      StackManagement.openRulesPage();
      isAlertingOverwritePageVisible();

      KibanaNavigation.openHomepage();

      StackManagement.openConnectorsPage();
      if (rorKbnReleaseBefore(CONNECTORS_OVERWRITE_FIX)) {
        cy.log(`Skipped: ROR KBN ${Cypress.env('rorKbnVersion')} misses the Connectors overwrite (RORDEV-2185)`);
      } else {
        isAlertingOverwritePageVisible();
      }
    } else {
      StackManagement.openRulesAndConnectorsPage();
      isAlertingOverwritePageVisible();
    }
  });
});
