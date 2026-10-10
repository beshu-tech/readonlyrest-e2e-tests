import { Settings } from './Settings';
import { RorMenu } from './RorMenu';
import { Home } from './Home';
import { KibanaNavigation } from './KibanaNavigation';
import { Dashboard } from './Dashboard';
import { SubHeader } from './SubHeader';
import { Discover } from './Discover';
import { Canvas } from './Canvas';
import { IndexPattern } from './IndexPattern';
import { kibanaVersion } from '../helpers';
import { TENANCY_QUERY_STRING_KEY } from '../types';
import { Tenancy } from './Tenancy';
import { kbnApiClient } from '../helpers/KbnApiClient';
import { Login } from './Login';
import { Share } from './Share';

export class RoAndRoStrictKibanaAccessAssertions {
  static runAssertions(fixtureYamlFileName: string, credentials: string) {
    kbnApiClient.loadSampleData('ecommerce', credentials, 'template_group');
    Settings.setSettingsData(fixtureYamlFileName);
    Login.initialization();
    RoAndRoStrictKibanaAccessAssertions.changeTenancyAndAwaitSpaces('template');
    Home.sampleDataControlsHidden();

    cy.log('Verify Dashboard features');
    // From 9.3 the dashboards listing no longer issues `POST /content_management/rpc/search`, so the
    // 8.7+ branch below would wait for a request that never comes. 8.19 still issues it. The exact
    // release is unknown — this repo has no 9.0-9.2 e2e leg — so those versions stay on the branch
    // below rather than being moved on a guess.
    if (kibanaVersion.gte('9.3.0')) {
      cy.intercept('GET', '/s/default/app/dashboards**').as('dashboardsApp');
      Tenancy.getTenancyFromUrl().then(tenancy => {
        cy.visit(`/s/default/app/dashboards?${TENANCY_QUERY_STRING_KEY}=${tenancy}`);
      });
      cy.wait('@dashboardsApp', { timeout: 30000 }).its('response.statusCode').should('eq', 200);
    } else if (kibanaVersion.gte('8.7.0')) {
      cy.intercept('POST', /\/content_management\/rpc\/search/).as('dashboardsSearch');
      Tenancy.getTenancyFromUrl().then(tenancy => {
        cy.visit(`/s/default/app/dashboards?${TENANCY_QUERY_STRING_KEY}=${tenancy}`);
      });
      cy.wait('@dashboardsSearch', { timeout: 30000 }).its('response.statusCode').should('eq', 200);
    } else {
      Dashboard.openDashboard();
    }
    Dashboard.openItem(0);
    SubHeader.breadcrumbsLastItem('[eCommerce] Revenue Dashboard');
    Dashboard.writeControlsNotShown();
    Dashboard.waitForPanelsRendered();

    cy.log('Verify Lens panel renders without error');
    cy.get('[data-test-subj="embeddableError"]').should('not.exist');
    if (kibanaVersion.gte('7.10.0')) {
      cy.get('[data-test-subj="lnsVisualizationContainer"]').should('exist');
    }

    cy.log('Verify Discover features');
    KibanaNavigation.openPage('Discover');
    SubHeader.readonlyDiscoverBadgeVisible();
    Discover.writeControlsNotShown();

    cy.log('Verify discover Link sharing');
    Tenancy.getTenancyFromUrl().then(tenancy => {
      Share.open();
      Share.copyLinkAndCheck('discover', String(tenancy), { canWrite: false });
    });

    /*
     * It's deprecated and not visible in a Kibana 9.0.0 https://github.com/elastic/kibana/issues/200649
     */
    if (kibanaVersion.lt('9.0.0')) {
      cy.log('Verify Canvas features');

      if (kibanaVersion.gte('8.16.0')) {
        cy.intercept('/s/default/internal/canvas/fns').as('canvasResolve');
      } else if (kibanaVersion.gte('8.9.0')) {
        cy.intercept('/s/default/internal/canvas/fns?compress=true').as('canvasResolve');
      } else if (kibanaVersion.gte('7.17.15')) {
        cy.intercept('/s/default/api/canvas/fns?compress=true').as('canvasResolve');
      } else {
        cy.intercept('/s/default/internal/bsearch').as('canvasResolve');
      }

      KibanaNavigation.openPage('Canvas');
      Canvas.openItem(0);
      cy.wait('@canvasResolve');
      SubHeader.readonlyBadgeVisible();
      SubHeader.breadcrumbsLastItem('[eCommerce] Revenue Tracking');
      Canvas.writeControlsNotShown();
    }

    KibanaNavigation.openPage('Stack Management');
    cy.log('Verify navigation items');

    const VISIBLE_STACK_MANAGEMENT_ITEMS = kibanaVersion.gte('8.0.0')
      ? ['Reporting', 'Data Views', 'Saved Objects']
      : ['Reporting', 'Index Patterns', 'Saved Objects'];
    cy.get('.euiSideNavItem a').should('have.length', VISIBLE_STACK_MANAGEMENT_ITEMS.length);
    VISIBLE_STACK_MANAGEMENT_ITEMS.forEach(title => {
      cy.get(`span[title="${title}"]`).should('be.visible');
    });

    cy.log('Verify Index Pattern features');
    if (kibanaVersion.gte('8.0.0')) {
      KibanaNavigation.openSubPage('Data Views');
    } else {
      KibanaNavigation.openSubPage('Index Patterns');
    }

    IndexPattern.createButtonHidden();
    IndexPattern.openItem(0);
    SubHeader.readonlyBadgeVisible();
    if (kibanaVersion.gte('8.0.0')) {
      SubHeader.breadcrumbsLastItem('Kibana Sample Data eCommerce');
    } else {
      SubHeader.breadcrumbsLastItem('kibana_sample_data_ecommerce');
    }
    IndexPattern.deleteIndexPatternButtonHidden();
    IndexPattern.addIndexButtonHidden();
    IndexPattern.rowEditItemButtonsHidden();
  }

  // Kibana 9.4.0 to 9.5.3 loads the spaces chunks seconds after the page, and the space selector shows
  // when they are loaded. A wait for the chunk request fails when the page before the tenancy change
  // loaded the chunks already: the new page then takes them from the browser cache.
  private static changeTenancyAndAwaitSpaces(tenancyName: string) {
    RorMenu.changeTenancy(tenancyName);

    if (kibanaVersion.gte('9.4.0') && kibanaVersion.lte('9.5.3')) {
      cy.get('[data-test-subj="spacesNavSelector"]').should('be.visible');
    }
  }
}
