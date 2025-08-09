import * as semver from 'semver';
import { KibanaNavigation } from './KibanaNavigation';
import { getKibanaVersion } from '../helpers';

export class Discover {
  static createIndexPattern(indexPatternName: string) {
    cy.log('createIndexPattern');
    createKibanaIndexPattern(indexPatternName);

    if (semver.lt(getKibanaVersion(), '8.8.0')) {
      KibanaNavigation.openKibanaNavigation();
      cy.contains('Discover').click({ force: true });
    }

    cy.contains(indexPatternName).should('be.visible');
  }

  static saveReport(reportName: string) {
    cy.log('saveReport');
    KibanaNavigation.openKibanaNavigation();
    cy.contains('Discover').click();
    cy.get('[data-test-subj=discoverSaveButton]').click();
    cy.get('[data-test-subj=savedObjectTitle]').type(reportName);
    cy.get('[data-test-subj=confirmSaveSavedObjectButton]').click({ force: true });
    cy.contains('was saved', { timeout: 10000 }).should('exist');

    cy.findByRole('navigation', {
      name: /breadcrumb/i
    }).findByText(reportName);
  }

  static exportToCsv() {
    cy.log('exportToCsv');

    if (
      (semver.gte(getKibanaVersion(), '8.19.0') && semver.lt(getKibanaVersion(), '9.0.0')) ||
      semver.gte(getKibanaVersion(), '9.1.0')
    ) {
      cy.get('[data-test-subj=exportTopNavButton]').click();
    } else {
      cy.get('[data-test-subj=shareTopNavButton]').click();
      if (semver.gte(getKibanaVersion(), '8.15.0')) {
        cy.get('[data-test-subj=export]').click();
      } else {
        cy.get('[data-test-subj=sharePanel-CSVReports]').click();
      }
    }

    cy.get('[data-test-subj=generateReportButton]').click();
    cy.contains('Queued report for search', { timeout: 10000 }).should('exist');
    cy.contains('Queued report for search', { timeout: 10000 }).should('not.exist');

    /**
     * TODO: For now csv download crash cypress electron browser (it's probably works in case of other browsers).
     * For now we can skip it
     */
    // cy.get('[data-test-subj=downloadCompletedReportButton]').click();
    // cy.readFile('cypress/downloads/admin_search.csv').should('not.be.null');
  }

  static optionsButtonNotExist() {
    cy.log('Options button Not exist');
    if (semver.gte(getKibanaVersion(), '8.8.0')) {
      cy.findByText(/options/i).should('not.be.visible');
    } else {
      cy.findByText(/options/i).should('not.exist');
    }
  }

  static newButtonNotExist() {
    cy.log('New button Not exist');
    cy.findByText(/new/i).should('not.exist');
  }

  static saveButtonNotExist() {
    cy.log('Save button Not exist');
    cy.findByText('Save').should('not.exist');
  }

  static openDataViewPage = () => {
    cy.log('open data view page');

    const openDataPageForKibanaForAndAbove8_1_0 = () => {
      KibanaNavigation.openKibanaNavigation();
      cy.contains('Stack Management').click();
      cy.contains('Data Views').click();
    };

    const openDataPageForKibanaBefore7_18_1 = () => {
      KibanaNavigation.openKibanaNavigation();
      cy.contains('Discover').click();
    };

    if (semver.gte(getKibanaVersion(), '8.1.0')) {
      return openDataPageForKibanaForAndAbove8_1_0();
    }
    return openDataPageForKibanaBefore7_18_1();
  };
}

const createKibanaIndexPattern = (indexPatternName: string) => {
  const createIdentityForKibanaBefore7_15_1 = () => {
    cy.contains('Create index pattern').click();
    cy.get('[data-test-subj=createIndexPatternNameInput]').type(indexPatternName);
    cy.contains('Next step').click();
    cy.get('[data-test-subj=createIndexPatternTimeFieldSelect]').select('@timestamp');
    cy.intercept('/s/default/api/saved_objects/index-pattern').as('indexPattern');
    cy.get('[data-test-subj=createIndexPatternButton]').click({ force: true });
    cy.wait('@indexPattern');
  };

  const createIdentityForKibanaForAndAbove7_15_1 = () => {
    cy.get('[data-test-subj=emptyIndexPatternPrompt]').contains('Create index pattern').click();
    cy.get('[data-test-subj=createIndexPatternNameInput]').type(indexPatternName);
    cy.contains('Select a timestamp field for use with the global time filter.');
    cy.get('[data-test-subj=timestampField]').click();
    cy.contains('@timestamp').click({ force: true });
    cy.intercept('/s/default/api/saved_objects/index-pattern').as('indexPattern');
    cy.get('[data-test-subj=saveIndexPatternButton]').click({ force: true });
    cy.wait('@indexPattern');
  };

  const createIdentityForKibanaForAndAbove8_0_0 = () => {
    const createDataViewPossibleSelectors = [
      '[data-test-subj=emptyIndexPatternPrompt]', // >= 8.0.x
      '[data-test-subj=createDataViewButtonFlyout]', // >= 8.2.x
      '[data-test-subj=createDataViewButton]' // >= 8.4.x
    ];
    cy.get(createDataViewPossibleSelectors.join(','))
      .contains(/create.*data.*view/i, { matchCase: false })
      .click();
    cy.get('[data-test-subj=createIndexPatternNameInput]').type(indexPatternName); // regular index pattern field

    if (semver.gte(getKibanaVersion(), '8.4.0')) {
      cy.get('[data-test-subj=createIndexPatternTitleInput]').type(indexPatternName); // Added title field in 8.4.0
    }

    cy.contains('Select a timestamp field for use with the global time filter.');
    cy.get('[data-test-subj=timestampField]').click();
    cy.contains('@timestamp').click({ force: true });

    if (semver.gte(getKibanaVersion(), '8.9.0')) {
      cy.intercept('/s/default/api/kibana/management/saved_objects/**').as('indexPattern');
    } else {
      cy.intercept('/s/default/api/saved_objects/**').as('indexPattern');
    }

    cy.get('[data-test-subj=saveIndexPatternButton]').click({ force: true });

    cy.wait('@indexPattern');
  };

  if (semver.gte(getKibanaVersion(), '8.0.0')) {
    return createIdentityForKibanaForAndAbove8_0_0();
  }

  if (semver.gte(getKibanaVersion(), '7.15.1')) {
    return createIdentityForKibanaForAndAbove7_15_1();
  }

  return createIdentityForKibanaBefore7_15_1();
};
