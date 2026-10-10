import { KibanaNavigation } from './KibanaNavigation';
import { TopNav } from './TopNav';
import { kibanaVersion } from '../helpers';
import { ListingTable } from './ListingTable';

export class Dashboard {
  static openItem(number: number) {
    ListingTable.openItem(number);
  }

  /**
   * Waits until each panel of the open dashboard finished rendering. Kibana reporting and Kibana's own
   * tests use the same attributes: the viewport gives the panel count in data-shared-items-count, and
   * each panel sets data-render-complete="true" when it is done.
   */
  static waitForPanelsRendered() {
    cy.get('[data-shared-items-count]', { timeout: 30000 }).should($viewport => {
      const panelCount = Number($viewport.attr('data-shared-items-count'));
      expect(panelCount, 'panel count').to.be.greaterThan(0);
      const renderedCount = $viewport.closest('body').find('[data-render-complete="true"]').length;
      expect(renderedCount, 'rendered panels').to.be.at.least(panelCount);
    });
  }

  // Kibana 7.x names the copy action "Clone", and 8.x and later name it "Duplicate".
  static writeControlsNotShown() {
    cy.log('Dashboard write controls not shown');
    TopNav.checkControlsNotShown('shareTopNavButton', [
      'dashboardEditMode',
      'dashboardClone',
      'dashboardInteractiveSaveMenuItem'
    ]);
  }

  static verifyDashboardExists(dashboardName: string) {
    cy.log(`Verifying that dashboard "${dashboardName}" exists`);
    cy.get('[data-test-subj*="dashboardListingTitleLink"]').contains(dashboardName).should('exist');
  }

  static verifyDashboardNotExist(dashboardName: string) {
    cy.log(`Verifying that dashboard "${dashboardName}" does not exist`);
    cy.get('[data-test-subj*="dashboardListingTitleLink"]').contains(dashboardName).should('not.exist');
  }

  static openDashboard() {
    cy.log('Open dashboard');
    if (kibanaVersion.gte('8.0.0')) {
      KibanaNavigation.openPage('Dashboards');
    } else {
      KibanaNavigation.openPage('Dashboard');
    }
  }
}
