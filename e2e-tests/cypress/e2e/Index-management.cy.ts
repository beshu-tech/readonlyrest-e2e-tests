import { Login } from '../support/page-objects/Login';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { IndexManagement } from '../support/page-objects/IndexManagement';
import { esApiClient } from '../support/helpers/EsApiClient';
import { Discover } from '../support/page-objects/Discover';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { kibanaVersion } from '../support/helpers';
import { adminCredentials, user2Credentials } from '../support/helpers/credentials';
import { StackManagement } from '../support/page-objects/StackManagement';

const testIndexName = '.kibana_test';

describe('Index management', () => {
  beforeEach(() => {
    if (kibanaVersion.gte('8.0.0') && kibanaVersion.lt('9.0.0')) {
      // A test that stopped before its afterEach can leave this data view behind.
      kbnApiClient.deleteDataViewIfPresent('r', adminCredentials);
      kbnApiClient.createDataView(
        {
          data_view: {
            id: 'r',
            title: 'r*',
            name: 'ReadonlyREST Data view'
          }
        },
        adminCredentials
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

    if (kibanaVersion.gte('8.0.0') && kibanaVersion.lt('9.0.0')) {
      kbnApiClient.deleteDataViewIfPresent('r', adminCredentials);
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
    StackManagement.openPage('Index Management');
    IndexManagement.IncludeHiddenIndices();
    IndexManagement.searchIndices(testIndexName);
    IndexManagement.openIndex(testIndexName);
    IndexManagement.openIndexSettings();
    IndexManagement.verifyIndexSetting('priority', indexPriorityValue);

    if (kibanaVersion.gte('8.0.0')) {
      IndexManagement.openDiscoverIndex();
      Discover.verifyDocument(0, testIndexName);
    }

    // Delete index
    KibanaNavigation.openPage('Stack Management');
    StackManagement.openPage('Index Management');
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
    Login.initialization({ credentials: user2Credentials });
    KibanaNavigation.openPage('Stack Management');
    StackManagement.openPage('Index Management');
    IndexManagement.openDataStreams();
    IndexManagement.verifyDataStreamsEmptyPage();
  });
});
