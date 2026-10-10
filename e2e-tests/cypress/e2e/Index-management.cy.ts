import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { IndexManagement } from '../support/page-objects/IndexManagement';
import { esApiClient } from '../support/helpers/EsApiClient';
import { Discover } from '../support/page-objects/Discover';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { getKibanaVersion } from '../support/helpers';

const testIndexName = '.kibana_test';
const adminUserCredentials = 'admin:dev';

describe('Index management', () => {
  beforeEach(() => {
    if (semver.gte(getKibanaVersion(), '8.0.0') && semver.lt(getKibanaVersion(), '9.0.0')) {
      // A test that stopped before its afterEach can leave this data view behind.
      kbnApiClient.deleteDataView('r', adminUserCredentials, undefined, { failOnStatusCode: false });
      kbnApiClient.createDataView(
        {
          data_view: {
            id: 'r',
            title: 'r*',
            name: 'ReadonlyREST Data view'
          }
        },
        adminUserCredentials
      );
    }
  });

  afterEach(() => {
    esApiClient.indices().then(result => {
      result
        .filter(index => index.index.startsWith(testIndexName))
        .forEach(element => {
          esApiClient.deleteIndex(element.index);
        });
    });

    if (semver.gte(getKibanaVersion(), '8.0.0') && semver.lt(getKibanaVersion(), '9.0.0')) {
      kbnApiClient.deleteDataView('r', adminUserCredentials, undefined, { failOnStatusCode: false });
    }
  });

  it('should verify index management functionalities', () => {
    Login.initialization();

    const indexPriorityValue = '10';
    esApiClient.createIndex(testIndexName, {
      'index.priority': indexPriorityValue
    });
    esApiClient.addDocument(testIndexName, '0', { title: 'Sample document', content: 'This is a test document' });
    KibanaNavigation.openPage('Stack Management');
    KibanaNavigation.openSubPage('Index Management');
    IndexManagement.IncludeHiddenIndices();
    IndexManagement.searchIndices(testIndexName);
    IndexManagement.openIndex(testIndexName);
    IndexManagement.openIndexSettings();
    IndexManagement.verifyIndexSetting('priority', indexPriorityValue);

    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      IndexManagement.openDiscoverIndex();
      Discover.verifyDocument(0, testIndexName);
    }

    // Delete index
    KibanaNavigation.openPage('Stack Management');
    KibanaNavigation.openSubPage('Index Management');
    IndexManagement.IncludeHiddenIndices();
    IndexManagement.searchIndices(testIndexName);
    IndexManagement.openIndex(testIndexName);
    IndexManagement.selectDeleteActionFromContextMenu();

    IndexManagement.clickConfirmDeleteIndexButton();
    IndexManagement.verifyIndexNotListed(testIndexName);
    esApiClient.indices().then(indices => {
      expect(indices.map(index => index.index)).not.to.include(testIndexName);
    });
  });

  it('should verify empty data streams page', () => {
    const userCredentials = 'user2:dev';
    const [username, password] = userCredentials.split(':');
    Login.initialization({ credentials: { username, password } });
    KibanaNavigation.openPage('Stack Management');
    KibanaNavigation.openSubPage('Index Management');
    IndexManagement.openDataStreams();
    IndexManagement.verifyDataStreamsEmptyPage();
  });
});
