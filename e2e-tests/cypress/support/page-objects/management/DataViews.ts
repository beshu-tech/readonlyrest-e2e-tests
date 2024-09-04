import * as semver from 'semver';
import { getKibanaVersion } from '../../helpers';
import { Discover } from "../Discover";
import { KibanaNavigation } from "../KibanaNavigation";


export class DataViews {
  static deleteSavedObjectsIfExist(objectsNames: string[]) {
    cy.log('deleteSavedObjectsIfExist');
    KibanaNavigation.openKibanaNavigation();
    cy.contains('Stack Management').click();
    cy.contains('Saved Objects').click();

    for (const objectName of objectsNames) {

      // Delete "invoices" index pattern if it exists
      cy.get('[data-test-subj="savedObjectSearchBar"]').type(objectName + "{enter}");
      cy.wait(1000);
      cy.get('body').then($body => {
        // Find the table row containing *exactly* "invoices" in the title
        const $invoicesIndexPatternRow = $body.find(`[data-test-subj="savedObjectsTableRowTitle"] a`)
          .filter((index, el) => Cypress.$(el).text().trim() === objectName)
          .closest('tr').first(); // Get the parent row of the link

        if ($invoicesIndexPatternRow.length > 0) {
          cy.wrap($invoicesIndexPatternRow)
            .find('[type="checkbox"]')
            .click();
          cy.contains('Delete').click();
          cy.get('[data-test-subj="confirmModalConfirmButton"]').click();
          cy.log(`Deleted index pattern: ${ objectName }`);
        }
      });

      // Clear the search bar
      cy.get('[data-test-subj="savedObjectSearchBar"]').clear();
    }
  }

  static createDataView(dataViewName: string) {
    cy.log('createDataView');
    Discover.openDataViewPage();

    const createDataViewForKibanaBefore8_0_0 = () => {
      cy.get('[data-test-subj="createIndexPatternButtonFlyout"]').click();
      cy.get('[data-test-subj="createIndexPatternNameInput"]').type(`${ dataViewName }{del}`);
      cy.get('[data-test-subj="timestampField"]') // Find the timestamp field combobox
        .find('[data-test-subj="comboBoxToggleListButton"]') // Find the button to open the dropdown
        .click(); // Click the button to open the dropdown

      // Wait for the dropdown to appear
      cy.wait(500);

      // Find and click the "I don't want to use the time filter" option
      cy.get('[data-test-subj="comboBoxSearchInput"]').type(`--- I don't want to use the time filter ---`);
      cy.get('[data-test-subj="saveIndexPatternButton"]').click();
    };

    const createDataViewForKibanaForAndAbove8_0_0 = () => {
      const createDataViewPossibleSelectors = [
        '[data-test-subj=createDataViewButtonFlyout]', // >= 8.2.x
        '[data-test-subj=createDataViewButton]' // >= 8.4.x
      ];

      // Click the "Create data view" button, handling different selectors based on Kibana version
      cy.get(createDataViewPossibleSelectors.join(','))
        .contains(/create.*data.*view/i, {matchCase: false})
        .click();

      // Type the data view name into the appropriate input field, handling changes in 8.4.0+
      cy.get(
        [
          '[data-test-subj=createIndexPatternNameInput]', // regular index pattern field
          '[data-test-subj=createIndexPatternTitleInput]' // Added title field in 8.4.0
        ].join(',')
      ).then(els => {
        [...els].forEach(el => cy.wrap(el).type(`${ dataViewName }{del}`));
      });

      // Save the data view
      cy.get('[data-test-subj=saveIndexPatternButton]').click({force: true});
    };

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      createDataViewForKibanaForAndAbove8_0_0();
    } else {
      createDataViewForKibanaBefore8_0_0();
    }

    // Wait for the data view to be created and verify it's visible
    cy.contains('saved', {timeout: 10000, matchCase: false}).should('exist');

    cy.get('[data-test-subj="toastCloseButton"]').click();
    cy.contains('saved', {timeout: 10000}).should('not.exist');
    cy.findByRole('navigation', {name: /breadcrumb/i}).findByText(dataViewName);
  }
}