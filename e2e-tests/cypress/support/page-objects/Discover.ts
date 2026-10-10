import * as semver from 'semver';
import { KibanaNavigation } from './KibanaNavigation';
import { TopNav } from './TopNav';
import { getKibanaVersion } from '../helpers';
import { interceptNext } from '../helpers/interceptNext';

export class Discover {
  static createIndexPattern(indexPatternName: string) {
    cy.log('createIndexPattern');
    createKibanaIndexPattern(indexPatternName);

    if (semver.lt(getKibanaVersion(), '8.8.0')) {
      KibanaNavigation.openPage('Discover');
    }

    Discover.verifyIndexTitle(indexPatternName);
  }

  static saveReport(reportName: string) {
    cy.log('saveReport');
    KibanaNavigation.openPage('Discover');
    cy.get('[data-test-subj=discoverSaveButton]').click();
    cy.get('[data-test-subj=savedObjectTitle]').type(reportName, { delay: 0 });

    const createDiscoverSession = semver.gte(getKibanaVersion(), '9.0.0')
      ? interceptNext('createDiscoverSession', { method: 'POST', url: '**/api/content_management/rpc/create' })
      : undefined;

    cy.get('[data-test-subj=confirmSaveSavedObjectButton]').should('not.be.disabled').click();
    Discover.verifySearchSaved(reportName);

    if (createDiscoverSession) {
      Discover.reopenSavedDiscoverSession(reportName, createDiscoverSession);
    }
  }

  static verifySearchSaved(reportName: string) {
    cy.log('verifySearchSaved');
    cy.contains(`'${reportName}' was saved`, { timeout: 10000 }).should('exist');
  }

  /**
   * On Kibana 9.x, saving a brand-new Discover session does not reliably rebind the active tab
   * to the saved object (the tab keeps its default "Untitled" label even though the session was
   * saved under the right title) - reports generated right after save inherit that stale label.
   * Explicitly navigating to the saved object's own /view/<id> URL forces Discover to reinitialize
   * from the persisted session, which does set the tab label correctly.
   *
   * Kibana 8.19.18 has a related but distinct issue: even after this reopen, a CSV report
   * generated shortly after save can still have payload.title "Untitled Discover session"
   * (confirmed via proxy-level ES response logging) - the reopen fixes the visible tab label but
   * not whatever internal state the reporting export reads from. Callers that need to assert on
   * a report's title on <9.0.0 should not rely on saveReport's `reportName` alone.
   *
   * Sets the hash directly instead of cy.visit()'ing the target URL: Discover's router picks up
   * the route change the same way (it's hash-based), but a hash-only change skips tearing down and
   * re-fetching the whole document/JS bundle. saveReport can run several times in one spec
   * (e.g. Reporting.cy.ts), and the extra full page loads from cy.visit() were heavy enough to
   * crash the Electron renderer on memory-constrained CI runners.
   */
  private static reopenSavedDiscoverSession(reportName: string, createDiscoverSession: `@${string}`) {
    cy.log('reopenSavedDiscoverSession');
    cy.wait(createDiscoverSession).then(({ response }) => {
      const savedId = response?.body?.result?.result?.item?.id;
      if (!savedId) return;

      cy.window().then(win => {
        win.location.hash = `#/view/${savedId}`;
      });
    });
    // The breadcrumb, not any text: the "'<name>' was saved" toast also holds the name, and it shows
    // before Discover opens the session again.
    cy.get('[data-test-subj="breadcrumb last"]', { timeout: 20000 }).should('contain', reportName);
  }

  static exportToCsv() {
    cy.log('exportToCsv');

    if (semver.gte(getKibanaVersion(), '9.4.0')) {
      cy.getByDataTestSubj('app-menu-overflow-button').click();
      cy.getByDataTestSubj('exportTopNavButton').click();
      cy.getByDataTestSubj('exportMenuItem-CSV').click();
    } else if (semver.satisfies(getKibanaVersion(), '>=8.19.0 <9.0.0 || >=9.1.0')) {
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
  }

  static openShareDiscover() {
    cy.log('openShareDiscoverUrl');
    cy.getByDataTestSubj('shareTopNavButton').click();

    if (semver.lt(getKibanaVersion(), '8.0.0')) {
      cy.getByDataTestSubj('sharePanel-Permalinks').click();
    }
  }

  static clickCopyLinkButton(accessLevel: 'admin' | 'rw' | 'ro' | 'ro_strict') {
    cy.log('clickCopyLinkButton');

    if (semver.gte(getKibanaVersion(), '8.0.0') && ['admin', 'rw'].includes(accessLevel)) {
      const generateShortUrl = interceptNext('generateShortUrl', {
        method: 'POST',
        pathname: '/s/default/api/short_url'
      });
      cy.getByDataTestSubj('copyShareUrlButton').click();
      cy.wait(generateShortUrl);
    } else {
      cy.getByDataTestSubj('copyShareUrlButton').click();
    }
  }

  // Kibana 9.4 and later always puts New and Open in the overflow popover of the top menu. Open is
  // allowed, so it proves that the popover holds the items.
  static writeControlsNotShown() {
    cy.log('Discover write controls not shown');
    if (semver.gte(getKibanaVersion(), '9.4.0')) {
      TopNav.overflowButtonExists();
    }
    TopNav.checkControlsNotShown(
      'shareTopNavButton',
      ['discoverNewButton', 'discoverSaveButton', 'interactiveSaveMenuItem', 'discoverOptionsButton'],
      'discoverOpenButton'
    );
  }

  static openDataViewPage = () => {
    cy.log('open data view page');
    if (semver.gte(getKibanaVersion(), '8.1.0')) {
      KibanaNavigation.openPage('Stack Management');
      KibanaNavigation.openSubPage('Data Views');
    } else {
      KibanaNavigation.openPage('Discover');
    }
  };

  static verifyIndexPatternSwitchLink = (indexPatternName: string) => {
    cy.log('verify Index Pattern Switch Link');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.get('[data-test-subj*=detail-link]').contains(indexPatternName);
    } else {
      cy.get('[data-test-subj=indexPattern-switch-link]').contains(indexPatternName);
    }
  };

  static verifyDocumentWithTodayRange = (row: number, indexPatternName: string) => {
    cy.log('verify Document with Today Range');

    Discover.selectTodayDataRange();

    Discover.verifyDocument(row, indexPatternName);
  };

  static verifyDocument = (row: number, indexPatternName: string) => {
    cy.log('verify Document');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.contains('[data-test-subj="discoverCellDescriptionList"]', indexPatternName).eq(row).should('be.visible');
    } else {
      cy.get('[data-test-subj="docTableExpandToggleColumn"]').eq(row).click();
      cy.contains('[data-test-subj="tableDocViewRow-_index"]', indexPatternName).should('exist');
    }
  };

  static selectTodayDataRange = () => {
    cy.log('Select Today Data Range');
    const searchUrl = semver.gte(getKibanaVersion(), '9.0.0')
      ? `/s/default/internal/search/ese**`
      : `/s/default/internal/bsearch**`;

    const search = interceptNext('search', { method: 'POST', url: searchUrl });

    if (semver.gte(getKibanaVersion(), '9.5.0')) {
      cy.getByDataTestSubj('dateRangePickerControlButton').click();
      cy.getByDataTestSubj('dateRangePickerPresetItem-Today').click();
    } else {
      cy.getByDataTestSubj('superDatePickerToggleQuickMenuButton').click();
      cy.getByDataTestSubj('superDatePickerCommonlyUsed_Today').click();
    }

    cy.wait(search);
  };

  static toastErrorNotVisible = (message: string) => {
    cy.log('Toast Error not Visible');

    cy.contains('[data-test-subj="globalToastList"]', message).should('not.exist');
  };

  static discoverSearchCompleted = () => {
    cy.log('Discover search completed');
    cy.get('[data-test-subj="searchSessionIndicator"][data-state="completed"]').should('be.visible');
  };

  static verifyIndexTitle = (indexPatternName: string) => {
    cy.log('Verify Index title');

    if (semver.gte(getKibanaVersion(), '9.2.0')) {
      cy.contains('[data-test-subj="indexPatternTitle"]', indexPatternName).as('indexPatternTitle').scrollIntoView();
      cy.get('@indexPatternTitle').should('be.visible');
    } else {
      cy.contains(indexPatternName).should('be.visible');
    }
  };

  static openSaveSessionPanel = () => {
    cy.log('Open Save Session Panel');
    cy.get('button[aria-label="Search session complete"]').click();
  };

  static pressSaveSessionButton = () => {
    cy.log('Press Save Session Button');
    cy.getByDataTestSubj('searchSessionIndicatorSaveBtn').click();
    cy.getByDataTestSubj('searchSessionIndicatorSaveBtn').should('not.exist');
  };

  static pressManageSessionsButton = () => {
    cy.log('Press Manage Sessions Button');
    cy.getByDataTestSubj('searchSessionIndicatorViewSearchSessionsLink').click();
  };

  static verifyDiscoverFromSearchSessionCorrectlyRestored = () => {
    cy.log('Verify Discover from search session');

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      cy.contains(/You are viewing cached data from a specific time range/i).should('be.visible');
    } else {
      cy.getByDataTestSubj('searchSessionIndicator').should('be.visible');
    }
  };
}

const createKibanaIndexPattern = (indexPatternName: string) => {
  const createIdentityForKibanaBefore7_15_1 = () => {
    cy.contains('Create index pattern').click();
    cy.get('[data-test-subj=createIndexPatternNameInput]').type(indexPatternName);
    cy.contains('Next step').click();
    cy.get('[data-test-subj=createIndexPatternTimeFieldSelect]').select('@timestamp');
    const indexPattern = interceptNext('indexPattern', { url: '/s/default/api/saved_objects/index-pattern' });
    cy.get('[data-test-subj=createIndexPatternButton]').should('not.be.disabled').click();
    cy.wait(indexPattern);
  };

  const createIdentityForKibanaForAndAbove7_15_1 = () => {
    cy.get('[data-test-subj=emptyIndexPatternPrompt]').contains('Create index pattern').click();
    cy.get('[data-test-subj=createIndexPatternNameInput]').type(indexPatternName);
    cy.contains('Select a timestamp field for use with the global time filter.');
    cy.get('[data-test-subj=timestampField]').click();
    cy.contains('[role="option"]', '@timestamp').click();
    const indexPattern = interceptNext('indexPattern', { url: '/s/default/api/saved_objects/index-pattern' });
    cy.get('[data-test-subj=saveIndexPatternButton]').should('not.be.disabled').click();
    cy.wait(indexPattern);
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
    cy.contains('[role="option"]', '@timestamp').click();

    const indexPattern = semver.gte(getKibanaVersion(), '8.9.0')
      ? interceptNext('indexPattern', { url: '/s/default/api/kibana/management/saved_objects/**' })
      : interceptNext('indexPattern', { url: '/s/default/api/saved_objects/**' });

    cy.get('[data-test-subj=saveIndexPatternButton]').should('not.be.disabled').click();

    cy.wait(indexPattern);
  };

  if (semver.gte(getKibanaVersion(), '8.0.0')) {
    return createIdentityForKibanaForAndAbove8_0_0();
  }

  if (semver.gte(getKibanaVersion(), '7.15.1')) {
    return createIdentityForKibanaForAndAbove7_15_1();
  }

  return createIdentityForKibanaBefore7_15_1();
};
