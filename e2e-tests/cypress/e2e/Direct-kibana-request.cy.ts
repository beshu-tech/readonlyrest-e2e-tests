import * as semver from 'semver';
import { getKibanaVersion, userCredentials } from '../support/helpers';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { rorApiClient } from '../support/helpers/RorApiClient';

describe('Direct kibana request', () => {
  const user1 = 'user1:dev';
  const admin = 'admin:dev';

  beforeEach(() => {
    clearDirectKibanaRequestState();
    rorApiClient.configureRorIndexMainSettings('defaultSettings.yaml');
  });

  afterEach(() => {
    clearDirectKibanaRequestState();
    rorApiClient.configureRorIndexMainSettings('defaultSettings.yaml');
  });

  it('should check direct kibana request', () => {
    const verifySavedObjects = () => {
      kbnApiAdvancedClient.deleteSavedObjects(user1);

      cy.log('Import saved objects for user1');
      cy.kbnImport({
        endpoint: 'api/saved_objects/_import?overwrite=true',
        credentials: user1,
        fixtureFilename: 'file.ndjson'
      });

      cy.log('Get imported saved objects for user1 Administrators group');
      kbnApiAdvancedClient.getSavedObjects(user1).then(result => {
        const savedObjectIds = result.saved_objects.map(obj => obj.id);

        expect(savedObjectIds).to.includes('my-pattern');
        expect(savedObjectIds).to.includes('my-dashboard');
        expect(result.saved_objects).to.have.length(2);
      });

      cy.log('Get imported saved objects for admin Administrators group');
      kbnApiAdvancedClient.getSavedObjects(admin).then(result => {
        const savedObjectIds = result.saved_objects.map(obj => obj.id);

        expect(savedObjectIds).to.includes('my-pattern');
        expect(savedObjectIds).to.includes('my-dashboard');
        expect(result.saved_objects).to.have.length(2);
      });

      cy.log('Get imported saved objects for user1 infosec group');
      kbnApiAdvancedClient.getSavedObjects(user1, 'infosec_group').then(result => {
        const actual = result.saved_objects.some(
          saved_object => saved_object.id === 'my-pattern' || saved_object.id === 'my-dashboard'
        );
        expect(actual).to.be.false;
      });
    };

    const verifyDataViews = () => {
      kbnApiAdvancedClient.deleteDataViews(user1);
      cy.log('Create data_views for user1 Administrators group');
      kbnApiAdvancedClient.createDataView(
        {
          data_view: {
            id: 'logstash',
            title: 'logstash-*',
            name: 'My Logstash Data View'
          }
        },
        user1
      );

      cy.log('get all data_views for user1 infosec group');
      kbnApiAdvancedClient.getDataViews(userCredentials, 'infosec_group').then(result => {
        const actual = result.data_view.some(saved_object => saved_object.id === 'logstash');
        expect(actual).to.be.false;
      });
    };

    verifySavedObjects();
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      verifyDataViews();
    }
  });

  it('should create short URL with x-ror-tenancy-id header', () => {
    rorApiClient.configureRorIndexMainSettings('defaultSettings.yaml');

    const createShortUrl = semver.gte(getKibanaVersion(), '8.0.0')
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
          admin,
          'template_group'
        )
      : kbnApiClient.createShortUrlLegacy(admin, 'template_group');

    createShortUrl.then(response => {
      expect(response).to.have.property('id');
      const shortUrlId = response.id;

      cy.log('Verify short URL exists for template_group tenancy');
      kbnApiClient.getSavedObjects(admin, 'template_group').then(result => {
        const ids = result.saved_objects.map(obj => obj.id);
        expect(ids).to.include(shortUrlId);
      });

      cy.log('Verify short URL does not exist for different tenancy');
      kbnApiClient.getSavedObjects(admin, 'admins_group').then(result => {
        const ids = result.saved_objects.map(obj => obj.id);
        expect(ids).not.to.include(shortUrlId);
      });
    });
  });

  const clearDirectKibanaRequestState = () => {
    kbnApiAdvancedClient.deleteSavedObjects(user1);
    kbnApiAdvancedClient.deleteSavedObjects(admin);
    kbnApiAdvancedClient.deleteSavedObjects(admin, 'template_group');
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      kbnApiAdvancedClient.deleteDataViews(user1);
      kbnApiAdvancedClient.deleteDataViews(admin);
      kbnApiAdvancedClient.deleteDataViews(admin, 'template_group');
    }
  };
});
