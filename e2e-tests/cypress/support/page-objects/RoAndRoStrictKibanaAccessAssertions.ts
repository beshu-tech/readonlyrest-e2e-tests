import * as semver from 'semver';
import { Settings } from './Settings';
import { RorMenu } from './RorMenu';
import { Home } from './Home';
import { KibanaNavigation } from './KibanaNavigation';
import { Dashboard } from './Dashboard';
import { SubHeader } from './SubHeader';
import { Discover } from './Discover';
import { Canvas } from './Canvas';
import { IndexPattern } from './IndexPattern';
import { getKibanaVersion } from '../helpers';
import { Tenancy } from './Tenancy';
import { TENANCY_QUERY_STRING_KEY } from '../types';
import { kbnApiClient } from '../helpers/KbnApiClient';
import { Login } from './Login';

export class RoAndRoStrictKibanaAccessAssertions {
  static runAssertions(fixtureYamlFileName: string, credentials: string) {
    kbnApiClient.loadSampleData('ecommerce', credentials, 'template_group');
    Settings.setSettingsData(fixtureYamlFileName);
    Login.initialization();
    RorMenu.changeTenancy('template');
    Home.loadSampleDataButtonHidden();

    cy.log('Verify Dashboard features');
    Dashboard.openDashboard();
    Dashboard.openItem(0);
    SubHeader.breadcrumbsLastItem('[eCommerce] Revenue Dashboard');
    Dashboard.editButtonNotExist();
    Dashboard.cloneButtonNotExist();
    cy.waitForNetworkIdle('*.pbf', 3000, {
      timeout: 30000
    });

    cy.log('Verify Discover features');
    KibanaNavigation.openPage('Discover');
    SubHeader.readonlyBadgeVisible();
    Discover.optionsButtonNotExist();
    Discover.newButtonNotExist();
    Discover.saveButtonNotExist();

    cy.log('Verify discover Link sharing');
    Tenancy.getTenancyFromUrl().then(tenancy => {
      Discover.openShareDiscover();
      Discover.clickCopyLinkButton('ro');
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        cy.getValueFromClipboard()
          .should('contain', 'https://localhost:5601/s/default/app/r?l=DISCOVER_APP_LOCATOR')
          .should('contain', `&${TENANCY_QUERY_STRING_KEY}=${tenancy}`);
      } else {
        cy.getValueFromClipboard().should(
          'contain',
          `https://localhost:5601/s/default/app/discover?${TENANCY_QUERY_STRING_KEY}=${tenancy}#`
        );
      }
    });

    /*
     * It's deprecated and not visible in a Kibana 9.0.0 https://github.com/elastic/kibana/issues/200649
     */
    if (semver.lt(getKibanaVersion(), '9.0.0')) {
      cy.log('Verify Canvas features');

      if (semver.gte(getKibanaVersion(), '8.16.0')) {
        cy.intercept('/s/default/internal/canvas/fns').as('canvasResolve');
      } else if (semver.gte(getKibanaVersion(), '8.9.0')) {
        cy.intercept('/s/default/internal/canvas/fns?compress=true').as('canvasResolve');
      } else if (semver.gte(getKibanaVersion(), '7.17.15')) {
        cy.intercept('/s/default/api/canvas/fns?compress=true').as('canvasResolve');
      } else {
        cy.intercept('/s/default/internal/bsearch').as('canvasResolve');
      }

      KibanaNavigation.openPage('Canvas');
      Canvas.openItem(0);
      SubHeader.readonlyBadgeVisible();
      SubHeader.breadcrumbsLastItem('[eCommerce] Revenue Tracking');
      Canvas.addElementButtonNotExist();
      Canvas.editButtonNotExist();
      Canvas.workPadSettingsNotExist();
      cy.wait('@canvasResolve');
    }

    KibanaNavigation.openPage('Stack Management');
    cy.log('Verify navigation items');

    const VISIBLE_STACK_MANAGEMENT_ITEMS = semver.gte(getKibanaVersion(), '8.0.0')
      ? ['Reporting', 'Data Views', 'Saved Objects']
      : ['Reporting', 'Index Patterns', 'Saved Objects'];
    cy.get('.euiSideNavItem a').should('have.length', VISIBLE_STACK_MANAGEMENT_ITEMS.length);
    VISIBLE_STACK_MANAGEMENT_ITEMS.forEach(title => {
      cy.get(`span[title="${title}"]`).should('be.visible');
    });

    cy.log('Verify Index Pattern features');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      KibanaNavigation.openSubPage('Data Views');
    } else {
      KibanaNavigation.openSubPage('Index Patterns');
    }

    cy.findByText(/create index pattern/i).should('not.exist');
    IndexPattern.openItem(0);
    SubHeader.readonlyBadgeVisible();
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      SubHeader.breadcrumbsLastItem('Kibana Sample Data eCommerce');
    } else {
      SubHeader.breadcrumbsLastItem('kibana_sample_data_ecommerce');
    }
    IndexPattern.deleteIndexPatternButtonHidden();
    IndexPattern.addIndexButtonHidden();
    IndexPattern.rowEditItemButtonsHidden();
  }
}
