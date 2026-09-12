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

      // Rules -> Connectors with no homepage between them, unlike the pair above. Kibana moves
      // between those two pages in-app, so it wipes the children of the pageBody container without
      // replacing the container itself. A second ReactDOM.render() on that same node is then a
      // no-op reconciliation against a stale fiber tree, and the overwrite never reappears
      // (RORDEV-2185). The route through the homepage does not reproduce it, because the container
      // is replaced on the way.
      StackManagement.openRulesPage();
      isAlertingOverwritePageVisible();
      StackManagement.openConnectorsPage();
      isAlertingOverwritePageVisible();
    } else {
      StackManagement.openRulesAndConnectorsPage();
      isAlertingOverwritePageVisible();
    }
  });
});
