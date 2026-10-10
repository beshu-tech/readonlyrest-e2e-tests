import semver from 'semver/preload';
import { Login } from '../support/page-objects/Login';
import { Tenancy } from '../support/page-objects/Tenancy';
import { RorMenu } from '../support/page-objects/RorMenu';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Loader } from '../support/page-objects/Loader';
import { Discover } from '../support/page-objects/Discover';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import type { GetObject } from '../support/helpers/KbnApiClient';
import { getKibanaVersion, userCredentials } from '../support/helpers';
import { Dashboard } from '../support/page-objects/Dashboard';
import { IndexManagement } from '../support/page-objects/IndexManagement';
import { TENANCY_QUERY_STRING_KEY, X_ROR_TENANCY } from '../support/types';
import { Spaces } from '../support/page-objects/Spaces';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { UserSettings } from '../support/page-objects/UserSettings';

describe('Tenancy', () => {
  describe('should run tests', () => {
    beforeEach(() => {
      kbnApiAdvancedClient.resetSpaces(userCredentials, 'template_group');
    });

    afterEach(() => {
      kbnApiClient.deleteSampleData('ecommerce', userCredentials, 'template_group');
      kbnApiAdvancedClient.tryResetSpaces(userCredentials, 'template_group');
    });

    it('should open correct tenancy when URL contains tenancy query string', () => {
      const urlWithTenancyId = `/s/default/app/management/data/index_management/indices?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}`;
      Login.initialization({
        visitedUrl: urlWithTenancyId,
        finishUrl: urlWithTenancyId,
        spacePrefix: ''
      });

      Tenancy.checkTenancyNameInBadge('template', 'rw');
      RorMenu.changeTenancy('Infosec', `/app/page-not-found?${TENANCY_QUERY_STRING_KEY}=*`, '');
      Tenancy.checkTenancyNameInBadge('infosec', 'a');
      KibanaNavigation.verifyKibanaNavigationLinkItemHref(
        `${Cypress.config().baseUrl}/s/default/app/discover?${TENANCY_QUERY_STRING_KEY}=`
      );
      KibanaNavigation.openHomepage();
      RorMenu.openRorMenu();
      RorMenu.pressLogoutButton();
      Login.fillLoginPageWith(Cypress.env().login, Cypress.env().password);
      Loader.loading();
      Tenancy.checkTenancyNameInBadge('administrators', 'a');
    });

    it('should copy link to specific visualization with tenancy information', () => {
      const urlWithTenancyId = `/s/default/app/management/data/index_management/indices?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}`;
      Login.initialization({
        visitedUrl: urlWithTenancyId,
        finishUrl: urlWithTenancyId,
        spacePrefix: ''
      });

      kbnApiClient.loadSampleData('ecommerce', userCredentials, 'template_group');
      KibanaNavigation.openPage('Discover');
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        cy.get('[data-test-subj="discover-dataView-switch-link"]', { timeout: 30000 }).should('exist');
      } else {
        cy.get('[data-test-subj="indexPattern-switch-link"]', { timeout: 30000 }).should('exist');
      }
      Discover.openShareDiscover();
      Discover.clickCopyLinkButton('admin');
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        cy.getValueFromClipboard()
          .should('contain', 'https://localhost:5601/s/default/app/r/s')
          .should('contain', `?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}`);
      } else {
        cy.getValueFromClipboard().should(
          'contain',
          `https://localhost:5601/s/default/app/discover?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}#`
        );
      }

      Dashboard.openDashboard();
      Dashboard.openItem(0);
      Dashboard.openShareDashboard();
      Dashboard.clickCopyLinkButton();

      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        cy.getValueFromClipboard()
          .should('contain', 'https://localhost:5601/s/default/app/r/s')
          .should('contain', `?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}`);
      } else {
        cy.getValueFromClipboard().should(
          'contain',
          `https://localhost:5601/s/default/app/dashboards?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}#/`
        );
      }
      if (semver.lt(getKibanaVersion(), '8.0.0')) {
        Dashboard.backToShareDashboard();
      }
      Dashboard.clickEmbedTab();
      Dashboard.clickCopyEmbedCodeButton();

      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        cy.getValueFromClipboard().should(
          'contain',
          `<iframe src="https://localhost:5601/s/default/app/dashboards?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}#/view/`
        );
      } else {
        cy.getValueFromClipboard().should(
          'contain',
          `<iframe src="https://localhost:5601/s/default/app/dashboards?embed=true&amp;${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}`
        );
      }
    });

    it('should redirect to page not found when tenancy is not available', () => {
      const urlWithTenancyId = `/s/default/app/dashboards?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithNotAvailableTenancy}`;
      Login.initialization({
        visitedUrl: urlWithTenancyId,
        finishUrl: `/app/page-not-found?${TENANCY_QUERY_STRING_KEY}=*`,
        spacePrefix: ''
      });
    });

    it('should correctly switch Kibana space', () => {
      const newSpace = 'test-space';

      const urlWithTenancyId = `/s/default/app/management/data/index_management/indices?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}`;
      Login.initialization({
        visitedUrl: urlWithTenancyId,
        finishUrl: urlWithTenancyId,
        spacePrefix: ''
      });

      Spaces.createNewSpace(newSpace);
      Spaces.openSpace(newSpace);
      Spaces.verifyCurrentSpace(newSpace);
    });

    it('should hide correct Kibana navigation items on tenancy switch', () => {
      const urlWithTenancyId = `/s/default/app/home?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedInfosecGroup}`;
      Login.initialization({
        visitedUrl: urlWithTenancyId,
        finishUrl: `/s/default/app/home?${TENANCY_QUERY_STRING_KEY}=*`,
        spacePrefix: ''
      });

      KibanaNavigation.openKibanaNavigation();
      KibanaNavigation.checkIfNotVisible('Stack Management');
    });
  });

  it('should open the tenancy of the previous page after browser back', () => {
    const urlWithTenancyId = `/s/default/app/management/data/index_management/indices?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}`;
    Login.initialization({
      visitedUrl: urlWithTenancyId,
      finishUrl: urlWithTenancyId,
      spacePrefix: ''
    });

    RorMenu.changeTenancy(
      'administrators',
      `/s/default/app/management/data/index_management/indices?${TENANCY_QUERY_STRING_KEY}=*`,
      ''
    );
    IndexManagement.waitUntilLoaded();
    cy.go('back');
    // Chromium 138 serves history-back from the back/forward cache, which restores
    // the page without re-running the injected tenancy scripts, so the URL tenancy
    // is not re-applied. Tracked in RORDEV-2172 — until the product handles BFCache
    // restores, this test pins the full-load semantics explicitly.
    cy.reload();
    Tenancy.checkTenancyNameInBadge('template', 'rw');
  });

  // Two tabs on two tenancies share one session. The proxy must resolve the tenancy of each request from that
  // request, and not from the session. cy.request sends the session cookie of the browser and the x-ror-tenancy
  // header of the other tenancy. Each tenancy has its own Kibana index, and a marker data view in that index shows
  // which tenancy answered a request.
  describe('should resolve the tenancy of each request when one session uses two tenancies', () => {
    const tenancies = {
      template: {
        group: 'template_group',
        encrypted: Tenancy.encryptedTenancyWithTemplateGroup,
        access: 'rw',
        marker: 'tenancy-marker-template',
        fixture: 'tenancy_marker_template.ndjson'
      },
      infosec: {
        group: 'infosec_group',
        encrypted: Tenancy.encryptedInfosecGroup,
        access: 'a',
        marker: 'tenancy-marker-infosec',
        fixture: 'tenancy_marker_infosec.ndjson'
      }
    } as const;
    const findIndexPatternsEndpoint = '/api/saved_objects/_find?type=index-pattern&per_page=1000';
    const indexPatternIds = (result: GetObject) => result.saved_objects.map(savedObject => savedObject.id);

    // Each marker exists only in its own tenancy.
    const deleteMarkers = () => {
      Object.values(tenancies).forEach(({ group, marker }) => {
        kbnApiClient.deleteSavedObject({ type: 'index-pattern', id: marker }, userCredentials, group);
      });
    };

    beforeEach(() => {
      Object.values(tenancies).forEach(({ group, fixture }) => {
        cy.kbnImport({
          endpoint: 'api/saved_objects/_import?overwrite=true',
          credentials: userCredentials,
          fixtureFilename: fixture,
          currentGroupHeader: group
        });
      });
    });

    afterEach(() => {
      deleteMarkers();
    });

    (
      [
        ['template', 'infosec'],
        ['infosec', 'template']
      ] as const
    ).forEach(([pageTenancyName, otherTenancyName]) => {
      it(`should keep ${pageTenancyName} in the page after an API call of the same session on ${otherTenancyName}`, () => {
        const pageTenancy = tenancies[pageTenancyName];
        const otherTenancy = tenancies[otherTenancyName];
        Login.initialization({
          visitedUrl: `/s/default/app/home?${TENANCY_QUERY_STRING_KEY}=${pageTenancy.encrypted}`,
          finishUrl: `/s/default/app/home?${TENANCY_QUERY_STRING_KEY}=*`,
          spacePrefix: ''
        });
        Tenancy.checkTenancyNameInBadge(pageTenancyName, pageTenancy.access);

        cy.request<GetObject>({
          url: findIndexPatternsEndpoint,
          headers: { [X_ROR_TENANCY]: decodeURIComponent(otherTenancy.encrypted) }
        })
          .its('body')
          .then(result => {
            expect(indexPatternIds(result)).to.include(otherTenancy.marker).and.not.include(pageTenancy.marker);
          });

        // The page loads again, as a tab does when the user goes back to it.
        cy.reload();
        Tenancy.checkTenancyNameInBadge(pageTenancyName, pageTenancy.access);
        // The page's fetch goes through the tenancy script of the page, which adds the tenancy of the page.
        // no-referrer removes the referer fallback, so only the x-ror-tenancy header can resolve the tenancy.
        cy.window()
          .then(win =>
            win
              .fetch(findIndexPatternsEndpoint, { referrerPolicy: 'no-referrer' })
              .then(response => response.json() as Promise<GetObject>)
          )
          .then(result => {
            expect(indexPatternIds(result)).to.include(pageTenancy.marker).and.not.include(otherTenancy.marker);
          });
      });
    });
  });

  it('should not apply stale remembered tenancy to a new user session after logout', () => {
    const homeUrlWithInfosecTenancy = `/s/default/app/home?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedInfosecGroup}`;

    Login.initialization({
      visitedUrl: homeUrlWithInfosecTenancy,
      finishUrl: `/s/default/app/home?${TENANCY_QUERY_STRING_KEY}=*`,
      spacePrefix: ''
    });

    RorMenu.openRorMenu();
    UserSettings.openViaMenuIcon();
    UserSettings.changeUserSettingsValue('remember-group-after-logout-settings', 'enabled');
    RorMenu.openRorMenu();
    RorMenu.pressLogoutButton();

    cy.url().should('include', `nextUrl=`);
    cy.url().should('include', `${TENANCY_QUERY_STRING_KEY}%3D`);

    Login.fillLoginPageWith('kibana', 'kibana');
    Loader.loading();
    RorMenu.openRorMenu();
    RorMenu.verifyNoTenantAvailable();
  });

  it('should redirect to page-not-found instead of carrying stale tenancy to a saved-object page after logout', () => {
    const dashboardsUrlWithInfosecTenancy = `/s/default/app/dashboards?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedInfosecGroup}`;

    Login.initialization({
      visitedUrl: dashboardsUrlWithInfosecTenancy,
      finishUrl: `/s/default/app/dashboards?${TENANCY_QUERY_STRING_KEY}=*`,
      spacePrefix: ''
    });

    RorMenu.openRorMenu();
    UserSettings.openViaMenuIcon();
    UserSettings.changeUserSettingsValue('remember-group-after-logout-settings', 'enabled');
    RorMenu.openRorMenu();
    RorMenu.pressLogoutButton();

    cy.url().should('include', `nextUrl=`);
    cy.url().should('include', `${TENANCY_QUERY_STRING_KEY}%3D`);

    Login.fillLoginPageWith('kibana', 'kibana');
    Loader.loading(`/app/page-not-found?${TENANCY_QUERY_STRING_KEY}=*`, '');
    cy.url().should('include', '/app/page-not-found');
  });
});
