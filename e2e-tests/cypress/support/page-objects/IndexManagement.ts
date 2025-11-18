import * as semver from 'semver';
import { getKibanaVersion } from '../helpers';

export class IndexManagement {
  static IncludeHiddenIndices() {
    cy.log('Include hidden indices');

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.get('[data-test-subj="checkboxToggles-includeHiddenIndices"]').click();
    } else {
      cy.get('[data-test-subj="indexTableIncludeHiddenIndicesToggle"]').click();
    }
  }

  static searchIndices(indexName: string) {
    cy.log(`Search for index: ${indexName}`);

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.get('[data-test-subj="indicesSearch"]').type(indexName);
    } else {
      cy.get(
        'input[aria-label="This is a search bar. As you type, the results lower in the page will automatically filter."]'
      ).type(indexName);
    }
  }

  static openIndex(indexName: string) {
    cy.log('Open index');

    cy.contains('[data-test-subj="indexTableIndexNameLink"]', indexName).click();
  }

  static openIndexSettings() {
    cy.log('Open index settings');

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.get('[data-test-subj="indexDetailsTab-settings"]').click();
    } else {
      cy.contains('button[role="tab"]', 'Settings').click();
    }
  }

  static verifyIndexSetting(settingName: string, expectedValue: string) {
    cy.log(`Verify index setting: ${settingName} with value: ${expectedValue}`);

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.contains(settingName).siblings().eq(1).should('have.text', `"${expectedValue}"`);
    } else {
      cy.contains(`"${settingName}": "${expectedValue}",`).should('exist');
    }
  }

  static openDiscoverIndex() {
    cy.log('Open Discover index');

    cy.get('[data-test-subj="discoverButtonLink"]').click();
  }

  static openIndexActionsContextMenuButton() {
    cy.log('Open Index ActionsContextMenuButton');

    cy.get('[data-test-subj="indexActionsContextMenuButton"]').click();
  }

  static selectDeleteActionFromContextMenu() {
    cy.log('Open Index ActionsContextMenuButton');

    IndexManagement.openIndexActionsContextMenuButton();

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.get('[data-test-subj="deleteIndexMenuButton"]').click();
    } else {
      cy.contains('button', 'Delete index').click();
    }
  }

  static clickConfirmDeleteIndexButton() {
    cy.log('Click confirm delete index button');

    if (semver.lt(getKibanaVersion(), '8.0.0')) {
      cy.get('[for="confirmDeleteIndicesCheckbox"]').click();
    }

    cy.get('[data-test-subj="confirmModalConfirmButton"]').click();
  }

  static verifyIndexExists(indexName: string) {
    cy.log(`Search for index: ${indexName}`);

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.get('[data-test-subj="indicesSearch"]').type(indexName);
      cy.contains('No indices found').should('be.visible');
    } else {
      cy.contains('No indices to show').should('be.visible');
    }
  }
}
