import semver from 'semver';
import { KibanaNavigation } from './KibanaNavigation';
import { getKibanaVersion } from '../helpers';

export class Dashboard {
  static openItem(number) {
    cy.findAllByRole('row')
      .eq(number + 1)
      .within(() => {
        cy.findByRole('link').click();
      });
  }

  static editButtonNotExist() {
    cy.log('Edit button Not exist');
    cy.findByText(/edit/i).should('not.exist');
  }

  static cloneButtonNotExist() {
    cy.log('Clone button Not exist');
    cy.findByText(/clone/i).should('not.exist');
  }

  static verifyDashboardExists(dashboardName: string) {
    cy.log(`Verifying that dashboard "${dashboardName}" exists`);
    cy.get('[data-test-subj*="dashboardListingTitleLink"]').contains(dashboardName).should('exist');
  }

  static verifyDashboardNotExist(dashboardName: string) {
    cy.log(`Verifying that dashboard "${dashboardName}" does not exist`);
    cy.get('[data-test-subj*="dashboardListingTitleLink"]').contains(dashboardName).should('not.exist');
  }

  static openDashboards() {
    cy.log('Open dashboard');
    KibanaNavigation.openPage('Dashboards');
  }

  static openDashboard() {
    cy.log('Open dashboard');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      KibanaNavigation.openPage('Dashboards');
    } else {
      KibanaNavigation.openPage('Dashboard');
    }
  }

  static openShareDashboard() {
    cy.log('openShareDiscoverUrl');
    cy.getByDataTestSubj('shareTopNavButton').click();

    if (semver.lt(getKibanaVersion(), '8.0.0')) {
      cy.getByDataTestSubj('sharePanel-Permalinks').click();
    }
  }

  static clickCopyLinkButton() {
    cy.log('clickCopyLinkButton');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.intercept({ method: 'POST', pathname: '/s/default/api/short_url' }).as('generateShortUrl');
      cy.getByDataTestSubj('copyShareUrlButton').click();
      cy.wait('@generateShortUrl');
    } else {
      cy.getByDataTestSubj('copyShareUrlButton').click();
    }
  }

  static clickEmbedTab() {
    cy.log('clickEmbedTab');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.getByDataTestSubj('embed').click();
    } else {
      cy.getByDataTestSubj('sharePanel-Embedcode').click();
    }
  }

  static clickCopyEmbedCodeButton() {
    cy.log('clickCopyEmbedCodeButton');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.getByDataTestSubj('copyEmbedUrlButton').click();
    } else {
      cy.getByDataTestSubj('copyShareUrlButton').click();
    }
  }

  static backToShareDashboard() {
    cy.log('backToShareDashboard');
    if (semver.lt(getKibanaVersion(), '8.0.0')) {
      cy.getByDataTestSubj('contextMenuPanelTitleButton').click();
    }
  }
}
