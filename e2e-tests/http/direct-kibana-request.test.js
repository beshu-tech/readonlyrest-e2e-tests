import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  configureRorIndexMainSettings,
  createDataView,
  createShortUrl,
  createShortUrlLegacy,
  deleteDataViews,
  deleteSavedObjects,
  getDataViews,
  getSavedObjects
} from './api-clients.js';
import { getKibanaVersion, userCredentials, versionGte } from './config.js';
import { kbnImport } from './http-client.js';

describe('Direct kibana request', () => {
  const user1 = 'user1:dev';
  const admin = 'admin:dev';

  const clearDirectKibanaRequestState = async () => {
    await deleteSavedObjects(user1);
    await deleteSavedObjects(admin);
    await deleteSavedObjects(admin, 'template_group');
    if (versionGte(getKibanaVersion(), '8.0.0')) {
      await deleteDataViews(user1);
      await deleteDataViews(admin);
      await deleteDataViews(admin, 'template_group');
    }
  };

  beforeEach(async () => {
    await clearDirectKibanaRequestState();
    await configureRorIndexMainSettings('defaultSettings.yaml');
  });

  afterEach(async () => {
    await clearDirectKibanaRequestState();
    await configureRorIndexMainSettings('defaultSettings.yaml');
  });

  it('should check direct kibana request', async () => {
    const verifySavedObjects = async () => {
      await deleteSavedObjects(user1);

      console.log('Import saved objects for user1');
      await kbnImport({
        endpoint: 'api/saved_objects/_import?overwrite=true',
        credentials: user1,
        fixtureFilename: 'file.ndjson'
      });

      console.log('Get imported saved objects for user1 Administrators group');
      const user1Objects = await getSavedObjects(user1);
      const user1ObjectIds = user1Objects.saved_objects.map(obj => obj.id);

      assert.ok(user1ObjectIds.includes('my-pattern'), `my-pattern is missing from ${JSON.stringify(user1ObjectIds)}`);
      assert.ok(
        user1ObjectIds.includes('my-dashboard'),
        `my-dashboard is missing from ${JSON.stringify(user1ObjectIds)}`
      );
      assert.equal(user1Objects.saved_objects.length, 2);

      console.log('Get imported saved objects for admin Administrators group');
      const adminObjects = await getSavedObjects(admin);
      const adminObjectIds = adminObjects.saved_objects.map(obj => obj.id);

      assert.ok(adminObjectIds.includes('my-pattern'), `my-pattern is missing from ${JSON.stringify(adminObjectIds)}`);
      assert.ok(
        adminObjectIds.includes('my-dashboard'),
        `my-dashboard is missing from ${JSON.stringify(adminObjectIds)}`
      );
      assert.equal(adminObjects.saved_objects.length, 2);

      console.log('Get imported saved objects for user1 infosec group');
      const infosecObjects = await getSavedObjects(user1, 'infosec_group');
      const leaked = infosecObjects.saved_objects.some(
        saved_object => saved_object.id === 'my-pattern' || saved_object.id === 'my-dashboard'
      );

      assert.equal(leaked, false, `the Administrators objects reached the infosec tenancy: ${JSON.stringify(leaked)}`);
    };

    const verifyDataViews = async () => {
      await deleteDataViews(user1);

      console.log('Create data_views for user1 Administrators group');
      await createDataView(
        {
          data_view: {
            id: 'logstash',
            title: 'logstash-*',
            name: 'My Logstash Data View'
          }
        },
        user1
      );

      console.log('get all data_views for user1 infosec group');
      const infosecDataViews = await getDataViews(userCredentials, 'infosec_group');
      const leaked = infosecDataViews.data_view.some(saved_object => saved_object.id === 'logstash');

      assert.equal(leaked, false, 'the Administrators data view reached the infosec tenancy');
    };

    await verifySavedObjects();
    if (versionGte(getKibanaVersion(), '8.0.0')) {
      await verifyDataViews();
    }
  });

  it('should create short URL with x-ror-tenancy-id header', async () => {
    await configureRorIndexMainSettings('defaultSettings.yaml');

    const response = versionGte(getKibanaVersion(), '8.0.0')
      ? await createShortUrl(
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
      : await createShortUrlLegacy(admin, 'template_group');

    assert.ok(
      response !== null && typeof response === 'object' && 'id' in response,
      `the short URL response carries no id: ${JSON.stringify(response)}`
    );
    const shortUrlId = response.id;

    console.log('Verify short URL exists for template_group tenancy');
    const templateObjects = await getSavedObjects(admin, 'template_group');
    const templateIds = templateObjects.saved_objects.map(obj => obj.id);

    assert.ok(templateIds.includes(shortUrlId), `${shortUrlId} is missing from ${JSON.stringify(templateIds)}`);

    console.log('Verify short URL does not exist for different tenancy');
    const adminsObjects = await getSavedObjects(admin, 'admins_group');
    const adminsIds = adminsObjects.saved_objects.map(obj => obj.id);

    assert.ok(
      !adminsIds.includes(shortUrlId),
      `${shortUrlId} reached the admins tenancy: ${JSON.stringify(adminsIds)}`
    );
  });
});
