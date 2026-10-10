import semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { Settings } from '../support/page-objects/Settings';
import { StackManagement } from '../support/page-objects/StackManagement';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Discover } from '../support/page-objects/Discover';
import { Dashboard } from '../support/page-objects/Dashboard';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { getKibanaVersion } from '../support/helpers';

const userCredentials = 'user2:dev';
const forbiddenMessage = 'You shall not pass!';
const forbiddenTagName = 'forbidden-tag-delete';
const forbiddenAssignTagName = 'forbidden-tag-assign';

// The ROR patches show their toast and then rethrow the 403, so Kibana code with no catch leaves an
// unhandled rejection. Only that rejection is ignored, so a new error in the toast code still fails.
// Registered with `Cypress.on` at spec scope, not `cy.on` inside a test, so it also covers the hooks.
Cypress.on('uncaught:exception', (err, runnable, promise) => {
  if (promise && /\bForbidden\b/.test(err.message)) {
    return false;
  }
});

// The objects use fixed ids, so the leftovers of a failed attempt make the next attempt fail. An
// afterEach cannot promise a clean start on its own: a failed hook skips the rest of the cleanup.
// So both hooks clean up. The cleanup must run under the default settings, because the forbidden
// settings deny every delete.
const cleanUp = () => {
  Settings.setSettingsData('defaultSettings.yaml');
  // deleteDataViews() 404s on 7.x.
  kbnApiAdvancedClient.deleteSavedObjects(userCredentials);
  // Tags live in the creator's tenant.
  cy.kbnGet<{ tags?: Array<{ id: string; name: string }> }>({
    endpoint: 'api/saved_objects_tagging/tags',
    credentials: userCredentials,
    failOnStatusCode: false
  }).then(result => {
    // A logged-out Kibana answers with a login page, not the tags JSON; treat it as no tags.
    (result?.tags ?? [])
      .filter(tag => tag.name === forbiddenTagName || tag.name === forbiddenAssignTagName)
      .forEach(tag =>
        cy.kbnDelete({
          endpoint: `api/saved_objects_tagging/tags/${tag.id}`,
          credentials: userCredentials,
          failOnStatusCode: false
        })
      );
  });
};

describe('Forbidden responses', () => {
  beforeEach(() => {
    cleanUp();
    Settings.setSettingsData('forbiddenResponsesSettings.yaml');
  });

  afterEach(() => {
    cleanUp();
  });

  // _bulk_delete exists from Kibana 8.7.0.
  if (semver.gte(getKibanaVersion(), '8.7.0')) {
    it('keeps a saved object instead of hanging when bulk-delete is forbidden', () => {
      kbnApiClient.createDataView(
        { data_view: { id: 'forbidden-bulk-delete', title: 'r*', name: 'Forbidden bulk delete' } },
        userCredentials
      );

      Login.initialization({ credentials: { username: 'user2', password: 'dev' } });
      StackManagement.openSavedObjectsPage();
      cy.get('[data-test-subj="checkboxSelectAll"]').click();
      cy.get('[data-test-subj="savedObjectsManagementDelete"]').click();
      cy.get('[data-test-subj="confirmModalConfirmButton"]').click();

      // Baseline rows always exist; assert survival, not a row count.
      cy.contains('[data-test-subj~="savedObjectsTableRow"]', 'Forbidden bulk delete').should('exist');
      cy.contains('[data-test-subj="globalToastList"]', 'Successfully deleted 0');
      cy.contains('[data-test-subj="globalToastList"]', 'Some objects could not be deleted');
      cy.contains('[data-test-subj="globalToastList"]', forbiddenMessage);
      cy.contains('[data-test-subj="globalToastList"]', 'Root causes').should('not.exist');
    });

    it('shows only "Forbidden", never the configured message, when a dashboard delete is forbidden', () => {
      // error.message is response.statusText ("Forbidden"), not the body; addError isn't
      // patched like addDanger is. Known gap, not fixed.
      cy.kbnPost({
        endpoint: 'api/saved_objects/dashboard/forbidden-dashboard-listing-delete',
        credentials: userCredentials,
        payload: {
          attributes: { title: 'Forbidden dashboard listing delete', panelsJSON: '[]', optionsJSON: '{}' }
        }
      });

      Login.initialization({ credentials: { username: 'user2', password: 'dev' } });
      // Can race a ROR tenancy hop on first navigation.
      cy.waitForNetworkIdle('*', 500, { timeout: 10000 });
      Dashboard.openDashboard();
      cy.get('[data-test-subj="checkboxSelectRow-forbidden-dashboard-listing-delete"]').click();
      cy.get('[data-test-subj="deleteSelectedItems"]').click();
      cy.get('[data-test-subj="confirmModalConfirmButton"]').click();

      cy.contains('[data-test-subj="globalToastList"]', 'Error encountered while deleting dashboard');
      cy.contains('[data-test-subj="globalToastList"]', 'Forbidden');
      cy.contains('[data-test-subj="globalToastList"]', forbiddenMessage).should('not.exist');
      cy.get('[data-test-subj="errorToastBtn"]').click();
      cy.get('[data-test-subj="errorModalBody"]').contains('Forbidden');
      cy.get('[data-test-subj="errorModalBody"]').contains(forbiddenMessage).should('not.exist');
      Dashboard.verifyDashboardExists('Forbidden dashboard listing delete');
    });
  }

  // Kibana before 8.7.0 deletes one saved object at a time, through the single-delete patch.
  if (semver.lt(getKibanaVersion(), '8.7.0')) {
    it('shows a danger toast and keeps the row instead of faking a delete when a single saved-object delete is forbidden', () => {
      // On the list page ROR's patch resolves after the toast, so the table re-fetches the
      // objects and shows again the row that Elasticsearch did not delete.
      // No data-view API on 7.x; the generic saved objects API works on every version.
      cy.kbnPost({
        endpoint: 'api/saved_objects/index-pattern/forbidden-single-delete',
        credentials: userCredentials,
        payload: { attributes: { title: 'forbidden-single-delete*' } }
      });

      Login.initialization({ credentials: { username: 'user2', password: 'dev' } });
      StackManagement.openSavedObjectsPage();
      cy.get('[data-test-subj="checkboxSelectAll"]').click();
      cy.get('[data-test-subj="savedObjectsManagementDelete"]').click();
      cy.get('[data-test-subj="confirmModalConfirmButton"]').click();

      cy.contains('[data-test-subj="globalToastList"]', 'Object could not be deleted');
      cy.contains('[data-test-subj="globalToastList"]', forbiddenMessage);
      cy.contains('[data-test-subj~="savedObjectsTableRow"]', 'forbidden-single-delete').should('exist');
    });
  }

  if (semver.lt(getKibanaVersion(), '8.0.0')) {
    it('shows a danger toast and keeps the object instead of faking a delete when an inspect-page delete is forbidden', () => {
      cy.kbnPost({
        endpoint: 'api/saved_objects/dashboard/forbidden-inspect-delete',
        credentials: userCredentials,
        payload: { attributes: { title: 'Forbidden inspect delete', panelsJSON: '[]', optionsJSON: '{}' } }
      });

      Login.initialization({ credentials: { username: 'user2', password: 'dev' } });
      StackManagement.openSavedObjectsPage();
      // Actions sit behind a collapsed menu; the popover renders outside the row.
      cy.contains('tr', 'Forbidden inspect delete').find('[data-test-subj="euiCollapsedItemActionsButton"]').click();
      // An index pattern opens its own edit page here. A dashboard opens the generic inspect page.
      cy.get('[data-test-subj="savedObjectsTableAction-inspect"]').click();
      cy.get('[data-test-subj="savedObjectEditDelete"]').click();
      cy.get('[data-test-subj="confirmModalConfirmButton"]').click();

      cy.contains('[data-test-subj="globalToastList"]', 'Object could not be deleted');
      cy.contains('[data-test-subj="globalToastList"]', forbiddenMessage);
      cy.location('pathname').should('include', 'forbidden-inspect-delete');
      cy.contains('[data-test-subj="globalToastList"]', "Deleted '").should('not.exist');
    });

    it('shows a danger toast and keeps the edit page open when an index pattern delete is forbidden', () => {
      cy.kbnPost({
        endpoint: 'api/saved_objects/index-pattern/forbidden-edit-page-delete',
        credentials: userCredentials,
        payload: { attributes: { title: 'forbidden-edit-page-delete*' } }
      });

      Login.initialization({ credentials: { username: 'user2', password: 'dev' } });
      KibanaNavigation.openPage('Stack Management');
      KibanaNavigation.openSubPage('Index Patterns');
      cy.contains('a', 'forbidden-edit-page-delete*').click();
      cy.get('[data-test-subj="deleteIndexPatternButton"]').click();
      cy.get('[data-test-subj="confirmModalConfirmButton"]').click();

      cy.contains('[data-test-subj="globalToastList"]', 'Object could not be deleted');
      cy.contains('[data-test-subj="globalToastList"]', forbiddenMessage);
      cy.get('[data-test-subj="editIndexPattern"]').should('be.visible');
    });

    it("shows only Kibana's own generic error text, never the configured message, when a dashboard delete from the listing is forbidden", () => {
      // Same statusText bug as the 8.x/9.x dashboard test above; a plain object is passed
      // here, so the plugin's toast-error patch doesn't apply either. Known gap, not fixed.
      cy.kbnPost({
        endpoint: 'api/saved_objects/dashboard/forbidden-dashboard-listing-delete-7x',
        credentials: userCredentials,
        payload: {
          attributes: { title: 'Forbidden dashboard listing delete 7x', panelsJSON: '[]', optionsJSON: '{}' }
        }
      });

      Login.initialization({ credentials: { username: 'user2', password: 'dev' } });
      // Same tenancy-hop race as above.
      cy.waitForNetworkIdle('*', 500, { timeout: 10000 });
      Dashboard.openDashboard();
      cy.get('[data-test-subj="checkboxSelectRow-forbidden-dashboard-listing-delete-7x"]').click();
      cy.get('[data-test-subj="deleteSelectedItems"]').click();
      cy.get('[data-test-subj="confirmModalConfirmButton"]').click();

      cy.contains('[data-test-subj="globalToastList"]', 'Unable to delete dashboard(s)');
      cy.contains('[data-test-subj="globalToastList"]', 'Forbidden');
      cy.contains('[data-test-subj="globalToastList"]', forbiddenMessage).should('not.exist');
      cy.contains('[data-test-subj="globalToastList"]', 'Object could not be deleted').should('not.exist');
    });
  }

  it('shows a danger toast instead of staying silent when a tag delete is forbidden', () => {
    // Tag lives in the creator's tenant; admin can't see it.
    cy.kbnPost({
      endpoint: 'api/saved_objects_tagging/tags/create',
      credentials: userCredentials,
      payload: { name: forbiddenTagName, description: '', color: '#FF0000' }
    });

    Login.initialization({ credentials: { username: 'user2', password: 'dev' } });
    KibanaNavigation.openPage('Stack Management');
    KibanaNavigation.openSubPage('Tags');
    // Actions sit behind a collapsed menu; the popover renders outside the row.
    cy.contains('tr', forbiddenTagName).find('[data-test-subj="euiCollapsedItemActionsButton"]').click();
    cy.get('[data-test-subj="tagsTableAction-delete"]').click();
    cy.get('[data-test-subj="confirmModalConfirmButton"]').click();

    cy.contains('[data-test-subj="globalToastList"]', 'Tag could not be deleted');
    cy.contains('[data-test-subj="globalToastList"]', forbiddenMessage);
    cy.contains('[data-test-subj="globalToastList"]', 'Root causes').should('not.exist');
  });

  it('shows a danger toast when a tag assignment is forbidden', () => {
    cy.kbnPost({
      endpoint: 'api/saved_objects_tagging/tags/create',
      credentials: userCredentials,
      payload: { name: forbiddenAssignTagName, description: '', color: '#00FF00' }
    });
    // Only taggable types work here (not index-pattern); use a dashboard.
    cy.kbnPost({
      endpoint: 'api/saved_objects/dashboard/forbidden-tag-assign-dashboard',
      credentials: userCredentials,
      payload: { attributes: { title: 'Forbidden tag assign dashboard', panelsJSON: '[]', optionsJSON: '{}' } }
    });

    Login.initialization({ credentials: { username: 'user2', password: 'dev' } });
    KibanaNavigation.openPage('Stack Management');
    KibanaNavigation.openSubPage('Tags');
    cy.contains('tr', forbiddenAssignTagName).find('[data-test-subj="euiCollapsedItemActionsButton"]').click();
    cy.get('[data-test-subj="tagsTableAction-assign"]').click();
    cy.get('[data-test-subj="assign-result-dashboard-forbidden-tag-assign-dashboard"]').click();
    cy.get('[data-test-subj="assignFlyoutConfirmButton"]').click();

    cy.contains('[data-test-subj="globalToastList"]', 'Tag assignments could not be saved');
    cy.contains('[data-test-subj="globalToastList"]', forbiddenMessage);
  });

  // Before 8.7.0 the single-delete patch covers the data view delete. From 9.2.0 Kibana catches it.
  if (semver.satisfies(getKibanaVersion(), '>=8.7.0 <9.2.0')) {
    it('shows a danger toast instead of staying silent when a data view delete is forbidden', () => {
      kbnApiClient.createDataView(
        {
          data_view: {
            id: 'forbidden-data-view-delete-interceptor',
            title: 'r*',
            name: 'Forbidden data view delete interceptor'
          }
        },
        userCredentials
      );

      Login.initialization({ credentials: { username: 'user2', password: 'dev' } });
      Discover.openDataViewPage();
      cy.contains('tr', 'Forbidden data view delete interceptor').find('[data-test-subj="action-delete"]').click();
      cy.get('[data-test-subj="confirmModalConfirmButton"]').click();

      cy.contains('[data-test-subj="globalToastList"]', 'Data view could not be deleted');
      cy.contains('[data-test-subj="globalToastList"]', forbiddenMessage);
    });
  }

  // Only the flyout of 9.2.0 and later passes a bare Error with no title/text.
  if (semver.gte(getKibanaVersion(), '9.2.0')) {
    it('fills the empty delete-data-view toast with the forbidden message', () => {
      kbnApiClient.createDataView(
        { data_view: { id: 'forbidden-data-view-delete', title: 'r*', name: 'Forbidden data view delete' } },
        userCredentials
      );

      Login.initialization({ credentials: { username: 'user2', password: 'dev' } });
      Discover.openDataViewPage();
      cy.contains('tr', 'Forbidden data view delete').find('[data-test-subj="action-delete"]').click();
      cy.get('[data-test-subj="confirmFlyoutConfirmButton"]').click();

      cy.contains('[data-test-subj="globalToastList"]', forbiddenMessage);
      cy.contains('[data-test-subj="globalToastList"]', 'Root causes').should('not.exist');
    });
  }
});
