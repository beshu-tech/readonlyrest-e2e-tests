import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { StackManagement } from '../support/page-objects/StackManagement';
import { DirectKibanaRequest, GetObject } from '../support/page-objects/DirectKibanaRequest';
import { getKibanaVersion } from '../support/helpers';

describe('Saved objects', () => {
  beforeEach(() => {
    Login.initialization();
    StackManagement.openSavedObjectsPage();
  });

  afterEach(() => {
    const clearSavedObjects = () => {
      cy.getRequest({ url: DirectKibanaRequest.getObjectsUrl() }).then((result: GetObject) => {
        result.saved_objects.map(savedObject =>
          cy.deleteRequest({ url: DirectKibanaRequest.deleteObjectUrl(savedObject.type, savedObject.id) })
        );
      });
    };

    clearSavedObjects();
  });

  it('should display saved objects list', () => {
    cy.get('[data-test-subj~="savedObjectsTableRow"]').should(
      'have.length',
      semver.gte(getKibanaVersion(), '8.0.0') ? 2 : 1
    );
    cy.get('[data-test-subj="importObjects"]').click();
    cy.get('input[type=file]').selectFile('cypress/fixtures/saved_objects_8.11.3.ndjson');
    cy.get('[data-test-subj="importSavedObjectsImportBtn"]').click();
    cy.get('[data-test-subj="importSavedObjectsDoneBtn"]').click();
    cy.get('[data-test-subj~="savedObjectsTableRow"]').should(
      'have.length',
      semver.gte(getKibanaVersion(), '8.0.0') ? 3 : 2
    );
  });
});
