import { Login } from '../support/page-objects/Login';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { IndexManagement } from '../support/page-objects/IndexManagement';
import { esApiClient } from '../support/helpers/EsApiClient';
import { Discover } from '../support/page-objects/Discover';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { kibanaVersion } from '../support/helpers';
import { user2Credentials, user5Credentials } from '../support/helpers/credentials';
import { StackManagement } from '../support/page-objects/StackManagement';

const indexWithKibanaPrefix = '.kibana_test';

describe('Index management', () => {
  beforeEach(() => {
    if (kibanaVersion.gte('8.0.0') && kibanaVersion.lt('9.0.0')) {
      // A test that stopped before its afterEach can leave this data view behind.
      kbnApiClient.deleteDataViewIfPresent('r', user5Credentials);
      kbnApiClient.createDataView(
        {
          data_view: {
            id: 'r',
            title: 'r*',
            name: 'ReadonlyREST Data view'
          }
        },
        user5Credentials
      );
    }
  });

  afterEach(() => {
    esApiClient.indices().then(result => {
      result
        .filter(index => index.index.startsWith(indexWithKibanaPrefix))
        .forEach(element => {
          esApiClient.deleteIndex(element.index);
        });
    });

    if (kibanaVersion.gte('8.0.0') && kibanaVersion.lt('9.0.0')) {
      kbnApiClient.deleteDataViewIfPresent('r', user5Credentials);
    }
  });

  it('should send the index name to ES unchanged, not replaced with the Kibana index of the user', () => {
    Login.initialization({ credentials: user5Credentials });

    const indexPriorityValue = '10';
    esApiClient.createIndex(indexWithKibanaPrefix, {
      'index.priority': indexPriorityValue
    });
    esApiClient.addDocument(indexWithKibanaPrefix, '0', {
      title: 'Sample document',
      content: 'This is a test document'
    });
    KibanaNavigation.openPage('Stack Management');
    StackManagement.openPage('Index Management');
    IndexManagement.IncludeHiddenIndices();
    IndexManagement.searchIndices(indexWithKibanaPrefix);
    IndexManagement.openIndex(indexWithKibanaPrefix);
    IndexManagement.openIndexSettings();
    IndexManagement.verifyIndexSetting('priority', indexPriorityValue);

    if (kibanaVersion.gte('8.0.0')) {
      IndexManagement.openDiscoverIndex();
      Discover.verifyDocument(0, indexWithKibanaPrefix);
    }

    // Delete index
    KibanaNavigation.openPage('Stack Management');
    StackManagement.openPage('Index Management');
    IndexManagement.IncludeHiddenIndices();
    IndexManagement.searchIndices(indexWithKibanaPrefix);
    IndexManagement.openIndex(indexWithKibanaPrefix);
    IndexManagement.selectDeleteActionFromContextMenu();

    IndexManagement.clickConfirmDeleteIndexButton();
    IndexManagement.verifyIndexNotListed(indexWithKibanaPrefix);
    esApiClient.indices().then(indices => {
      expect(indices.map(index => index.index)).not.to.include(indexWithKibanaPrefix);
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
