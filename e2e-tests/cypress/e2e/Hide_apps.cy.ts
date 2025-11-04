import { Settings } from '../support/page-objects/Settings';
import { Login } from '../support/page-objects/Login';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { RorMenu } from '../support/page-objects/RorMenu';
import semver from 'semver/preload';
import { getKibanaVersion } from '../support/helpers';

describe('Hide apps', () => {
  beforeEach(() => {
    Settings.setSettingsData('hiddenSpaceManagementSettings.yaml');
    Login.initialization();
  });

  afterEach(() => {
    Settings.setSettingsData('defaultSettings.yaml');
  });

  it('should hide all apps except of Stack Management', () => {
    RorMenu.openReportingPage();
    KibanaNavigation.checkStackManagementSectionElementsCount('ingest', 0);
    KibanaNavigation.checkStackManagementSectionElementsCount('data', 0);
    KibanaNavigation.checkStackManagementSectionElementsCount('insightsAndAlerting', 1);
    KibanaNavigation.checkStackManagementSectionElementsCount('kibana', 2);
    KibanaNavigation.checkIfStackManagementSubPageVisible('Reporting');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      KibanaNavigation.checkIfStackManagementSubPageVisible('Data Views');
    } else {
      KibanaNavigation.checkIfStackManagementSubPageVisible('Index Patterns');
    }
    KibanaNavigation.checkIfStackManagementSubPageVisible('Saved Objects');
  });
});
