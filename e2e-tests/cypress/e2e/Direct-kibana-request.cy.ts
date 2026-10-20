import { kibanaVersion } from '../support/helpers';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { adminCredentials, BasicCredentials, user1Credentials } from '../support/helpers/credentials';
import { Settings } from '../support/page-objects/Settings';

describe('Direct kibana request', () => {
  beforeEach(() => {
    clearDirectKibanaRequestState();
    Settings.setSettingsData('defaultReadonlyRestEsAndKbnSettings.yaml');
  });

  afterEach(() => {
    clearDirectKibanaRequestState();
    Settings.restoreDefaultSettings();
  });

  it('should check direct kibana request', () => {
    const verifySavedObjects = () => {
      kbnApiAdvancedClient.deleteSavedObjects(user1Credentials);

      cy.log('Import saved objects for user1');
      cy.kbnImport({
        endpoint: 'api/saved_objects/_import?overwrite=true',
        credentials: user1Credentials,
        fixtureFilename: 'file.ndjson'
      });

      cy.log('Get imported saved objects for user1 Administrators group');
      kbnApiAdvancedClient.getSavedObjects(user1Credentials).then(result => {
        const savedObjectIds = result.saved_objects.map(obj => obj.id);

        expect(savedObjectIds).to.includes('my-pattern');
        expect(savedObjectIds).to.includes('my-dashboard');
        expect(result.saved_objects).to.have.length(2);
      });

      cy.log('Get imported saved objects for admin Administrators group');
      kbnApiAdvancedClient.getSavedObjects(adminCredentials).then(result => {
        const savedObjectIds = result.saved_objects.map(obj => obj.id);

        expect(savedObjectIds).to.includes('my-pattern');
        expect(savedObjectIds).to.includes('my-dashboard');
        expect(result.saved_objects).to.have.length(2);
      });

      cy.log('Get imported saved objects for user1 infosec group');
      kbnApiAdvancedClient.getSavedObjects(user1Credentials, 'infosec_group').then(result => {
        const actual = result.saved_objects.some(
          saved_object => saved_object.id === 'my-pattern' || saved_object.id === 'my-dashboard'
        );
        expect(actual).to.equal(false);
      });
    };

    const verifyDataViews = () => {
      kbnApiAdvancedClient.deleteDataViews(user1Credentials);
      cy.log('Create data_views for user1 Administrators group');
      kbnApiAdvancedClient.createDataView(
        {
          data_view: {
            id: 'logstash',
            title: 'logstash-*',
            name: 'My Logstash Data View'
          }
        },
        user1Credentials
      );

      const dataViewIds = (credentials: BasicCredentials, group?: string) =>
        kbnApiAdvancedClient.getDataViews(credentials, group).then(result => result.data_view.map(view => view.id));

      cy.log('Get data_views for user1 Administrators group');
      dataViewIds(user1Credentials).should('include', 'logstash');

      cy.log('Get data_views for admin Administrators group');
      dataViewIds(adminCredentials).should('include', 'logstash');

      cy.log('Get data_views for user1 infosec group');
      dataViewIds(user1Credentials, 'infosec_group').should('not.include', 'logstash');
    };

    verifySavedObjects();
    if (kibanaVersion.gte('8.0.0')) {
      verifyDataViews();
    }
  });

  it('should create short URL with x-ror-tenancy-id header', () => {
    Settings.setSettingsData('defaultReadonlyRestEsAndKbnSettings.yaml');

    const createShortUrl = kibanaVersion.gte('8.0.0')
      ? kbnApiClient.createShortUrl(
          {
            locatorId: 'DISCOVER_APP_LOCATOR',
            params: {
              query: { language: 'kuery', query: '' },
              sort: [],
              columns: [],
              interval: 'auto',
              filters: [],
              dataViewSpec: {
                id: '63b9dbbe-18ae-42cb-b079-d0d41b3edb71',
                title: 'business_logs_index',
                sourceFilters: [],
                fieldFormats: {},
                runtimeFieldMap: {},
                allowNoIndex: false,
                name: 'business_logs_index',
                allowHidden: false
              },
              timeRange: {
                from: '2026-03-17T13:44:39.731Z',
                to: '2026-03-17T13:59:39.732Z'
              },
              refreshInterval: {
                value: 10000,
                pause: true
              }
            }
          },
          adminCredentials,
          'template_group'
        )
      : kbnApiClient.createShortUrlLegacy(adminCredentials, 'template_group');

    createShortUrl.then(response => {
      expect(response).to.have.property('id');
      const shortUrlId = response.id;

      cy.log('Verify short URL exists for template_group tenancy');
      kbnApiClient.getSavedObjects(adminCredentials, 'template_group').then(result => {
        const ids = result.saved_objects.map(obj => obj.id);
        expect(ids).to.include(shortUrlId);
      });

      cy.log('Verify short URL does not exist for different tenancy');
      kbnApiClient.getSavedObjects(adminCredentials, 'admins_group').then(result => {
        const ids = result.saved_objects.map(obj => obj.id);
        expect(ids).not.to.include(shortUrlId);
      });
    });
  });

  const clearDirectKibanaRequestState = () => {
    kbnApiAdvancedClient.deleteSavedObjects(user1Credentials);
    kbnApiAdvancedClient.deleteSavedObjects(adminCredentials);
    kbnApiAdvancedClient.deleteSavedObjects(adminCredentials, 'template_group');
    if (kibanaVersion.gte('8.0.0')) {
      kbnApiAdvancedClient.deleteDataViews(user1Credentials);
      kbnApiAdvancedClient.deleteDataViews(adminCredentials);
      kbnApiAdvancedClient.deleteDataViews(adminCredentials, 'template_group');
    }
  };
});
