import semver from 'semver/preload';
import { Login } from '../support/page-objects/Login';
import { Tenancy } from '../support/page-objects/Tenancy';
import { RorMenu } from '../support/page-objects/RorMenu';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Loader } from '../support/page-objects/Loader';
import { Discover } from '../support/page-objects/Discover';
import { Home } from '../support/page-objects/Home';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { getKibanaVersion, userCredentials } from '../support/helpers';
import { Dashboard } from '../support/page-objects/Dashboard';
import { TENANCY_QUERY_STRING_KEY } from '../support/types';
import { Spaces } from '../support/page-objects/Spaces';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { IndexManagement } from '../support/page-objects/IndexManagement';

describe('Tenancy', () => {
  describe('should run tests', () => {
    // eslint-disable-next-line no-use-before-define
    runTests();
  });

  describe('should run tests when back to previous page in a browser history', () => {
    const backBrowserHistory = (
      endUrl = `/s/default/app/management/data/index_management/indices?${TENANCY_QUERY_STRING_KEY}=*`
    ) => {
      IndexManagement.waitingForSectionLoadingFinish();
      RorMenu.changeTenancy('administrators', endUrl, '');
      cy.go('back');
    };

    // eslint-disable-next-line no-use-before-define
    runTests({ callbackAfterLogin: backBrowserHistory });
  });

  describe('should run tests when tenancy switched in a different tab', () => {
    const urlWithInfosecTenancyId = `/s/default/app/discover?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedInfosecGroup}`;

    const openAnotherTabs = () => {
      cy.window().then(win => {
        win.open(urlWithInfosecTenancyId, '_blank');
      });
    };

    // eslint-disable-next-line no-use-before-define
    runTests({ callbackBeforeLogin: openAnotherTabs });
  });
});

function runTests({
  callbackAfterLogin,
  callbackBeforeLogin
}: {
  callbackAfterLogin?: (endUrl?: string) => void;
  callbackBeforeLogin?: () => void;
} = {}) {
  afterEach(() => {
    kbnApiClient.deleteSampleData('ecommerce', userCredentials);
    kbnApiAdvancedClient.deleteAllSpaces(userCredentials, 'template_group');
  });

  it('should open correct tenancy when URL contains tenancy query string', () => {
    const urlWithTenancyId = `/s/default/app/management/data/index_management/indices?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}`;
    callbackBeforeLogin?.();
    Login.initialization({
      visitedUrl: urlWithTenancyId,
      finishUrl: urlWithTenancyId,
      spacePrefix: ''
    });

    callbackAfterLogin?.(`/s/default/app/management/data/index_management/indices?${TENANCY_QUERY_STRING_KEY}=*`);
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
    callbackBeforeLogin?.();
    Login.initialization({
      visitedUrl: urlWithTenancyId,
      finishUrl: urlWithTenancyId,
      spacePrefix: ''
    });

    callbackAfterLogin?.();
    Home.loadSampleData();
    KibanaNavigation.openPage('Discover');
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
    const urlWithTenancyId = `/s/default/app/management/data/index_management/indices?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithNotAvailableTenancy}`;
    Login.initialization({
      visitedUrl: urlWithTenancyId,
      finishUrl: `/app/page-not-found?${TENANCY_QUERY_STRING_KEY}=*`,
      spacePrefix: ''
    });
  });

  it('should correctly switch Kibana space', () => {
    const newSpace = 'test-space';

    const urlWithTenancyId = `/s/default/app/management/data/index_management/indices?${TENANCY_QUERY_STRING_KEY}=${Tenancy.encryptedTenancyWithTemplateGroup}`;
    callbackBeforeLogin?.();
    Login.initialization({
      visitedUrl: urlWithTenancyId,
      finishUrl: urlWithTenancyId,
      spacePrefix: ''
    });

    callbackAfterLogin?.();

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
}
