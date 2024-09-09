import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { StackManagement } from '../support/page-objects/StackManagement';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { getKibanaVersion } from '../support/helpers';

describe('Kibana-content-overwrite', () => {
  beforeEach(() => {
    Login.initialization();
  });

  it('should overwrite Kibana alerting content', () => {
    const isAlertingOverwritePageVisible = () => {
      if (semver.gte(getKibanaVersion(), '8.6.0')) {
        cy.contains(
          'Kibana alerting does not work with ReadonlyREST, but we are working on an even better alerting and reporting solution.'
        ).should('be.visible');
      } else {
        cy.contains(
          'Kibana alerting does not work with ReadonlyREST, but we are working on an even better alerting and reporting solution.'
        ).should('not.exist');
      }
    };

    if (semver.gte(getKibanaVersion(), '8.6.0')) {
      if (semver.gte(getKibanaVersion(), '8.14.0')) {
        StackManagement.openAlertsPage();
        isAlertingOverwritePageVisible();
        KibanaNavigation.openHomepage();
      }
      StackManagement.openRulesPage();
      isAlertingOverwritePageVisible();

      KibanaNavigation.openHomepage();

      StackManagement.openConnectorsPage();
      isAlertingOverwritePageVisible();
    } else {
      StackManagement.openRulesAndConnectorsPage();
      isAlertingOverwritePageVisible();
    }
  });
});
