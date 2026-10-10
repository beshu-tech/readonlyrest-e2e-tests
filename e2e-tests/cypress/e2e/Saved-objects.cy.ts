import { Login } from '../support/page-objects/Login';
import { StackManagement } from '../support/page-objects/StackManagement';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { admin } from '../support/helpers/credentials';

const ROW = '[data-test-subj~="savedObjectsTableRow"]';
const IMPORTED_DATA_VIEW = { type: 'index-pattern', id: '3b5651f9-8fa6-4da4-87ab-7db8ce7f6bb3' };

describe('Saved objects', () => {
  beforeEach(() => {
    // When the import finds this object already there, it overwrites it and the row count does not change.
    kbnApiAdvancedClient.deleteSavedObject(IMPORTED_DATA_VIEW, admin, undefined, { failOnStatusCode: false });
    Login.initialization();
    StackManagement.openSavedObjectsPage();
  });

  afterEach(() => {
    kbnApiAdvancedClient.deleteSavedObjects(admin);
  });

  // The count before the import depends on what earlier specs left in the tenancy, so the test checks
  // the change. Every tenancy has the Advanced Settings object, so a loaded list has 1 row or more.
  it('should display saved objects list', () => {
    cy.get(ROW)
      .should('have.length.at.least', 1)
      .its('length')
      .then(rowsBefore => {
        cy.get('[data-test-subj="importObjects"]').click();
        cy.get('input[type=file]').selectFile('cypress/fixtures/saved_objects_8.11.3.ndjson');
        cy.get('[data-test-subj="importSavedObjectsImportBtn"]').click();
        cy.get('[data-test-subj="importSavedObjectsDoneBtn"]').click();
        cy.get(ROW).should('have.length', rowsBefore + 1);
      });
  });
});
