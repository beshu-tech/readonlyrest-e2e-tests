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

export class RoAndRoStrictKibanaAccessAssertions {
  static runAssertions(fixtureYamlFileName: string) {
    RorMenu.changeTenancy('template', '/app/home#/');
    Home.loadSampleData();
    Settings.setSettingsData(fixtureYamlFileName);
    RorMenu.changeTenancy('administrators', '/app/home#/');
    RorMenu.changeTenancy('template', '/app/home#/');
    Home.loadSampleDataButtonHidden();

    cy.log('Verify Dashboard features');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      Dashboard.openDashboards();
    } else {
      Dashboard.openDashboard();
    }
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

    cy.log('Verify Index Pattern features');
    KibanaNavigation.openPage('Stack Management');
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
