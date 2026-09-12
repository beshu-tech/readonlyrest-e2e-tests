import { kibanaUserCredentials } from './config.js';
import { describeBody, esPost, kbnDelete, kbnGet, kbnPost, readFixture } from './http-client.js';

// Every `credentials` here is a Basic pair, `user:password`. CI keeps its logs, so a log line names
// the account and never the pair.
const accountOf = credentials => String(credentials).split(':')[0];

// cypress/support/helpers/RorApiClient.ts

export async function configureRorIndexMainSettings(fixtureYamlFileName) {
  const yamlContent = await readFixture(fixtureYamlFileName);

  return esPost({
    endpoint: '_readonlyrest/admin/config',
    credentials: kibanaUserCredentials,
    payload: { settings: `${yamlContent}` }
  });
}

// cypress/support/helpers/KbnApiClient.ts

const SAVED_OBJECTS_FIND =
  'api/saved_objects/_find?type=index-pattern&type=search&type=visualization&type=dashboard&type=url';

export const getSavedObjects = (credentials, group) => kbnGet({ endpoint: SAVED_OBJECTS_FIND, credentials, group });

export const deleteSavedObject = (savedObject, credentials, group, { failOnStatusCode = true } = {}) =>
  kbnDelete({
    endpoint: `api/saved_objects/${savedObject.type}/${savedObject.id}`,
    credentials,
    group,
    failOnStatusCode
  });

export const getDataViews = (credentials, group) => kbnGet({ endpoint: 'api/data_views', credentials, group });

export const createDataView = (dataView, credentials, group) =>
  kbnPost({ endpoint: 'api/data_views/data_view', credentials, group, payload: dataView });

export const deleteDataView = (dataViewId, credentials, group) =>
  kbnDelete({ endpoint: `api/data_views/data_view/${dataViewId}`, credentials, group });

export const createShortUrl = (payload, credentials, group) =>
  kbnPost({ endpoint: 's/default/api/short_url', credentials, group, payload });

export const createShortUrlLegacy = (credentials, group) =>
  kbnPost({
    endpoint: 'api/saved_objects/url',
    credentials,
    group,
    payload: {
      attributes: {
        url: '/app/discover',
        accessCount: 0,
        createDate: new Date().toISOString(),
        accessDate: new Date().toISOString()
      }
    }
  });

// cypress/support/helpers/KbnApiAdvancedClient.ts

export async function deleteSavedObjects(credentials, group) {
  console.log(`Get all saved objects for the ${accountOf(credentials)}`);
  const result = await getSavedObjects(credentials, group);

  // This cleanup races the stack it cleans: under resetKibanaIndexToTemplate the tenancy
  // index can be mid-reset, and a session sweep or config restart can log the request out,
  // in which case the _find answers with a login page instead of the find JSON. An index
  // that is already resetting has nothing left to clean, so treat that as the empty list.
  for (const savedObject of result?.saved_objects ?? []) {
    console.log(`Remove ${savedObject.id} saved object for ${accountOf(credentials)}`);
    // Best effort: an object listed a moment ago can already be gone (404). Losing that
    // race must not fail cleanup.
    await deleteSavedObject(savedObject, credentials, group, { failOnStatusCode: false });
  }
}

export async function deleteDataViews(credentials, group) {
  const account = accountOf(credentials);
  console.log(`get all data_views for the ${account}`);
  const result = await getDataViews(credentials, group);

  // api/data_views answers { data_view: [...] }, but it can also answer 2xx with a login page when a
  // session sweep or a config restart logs the request out. An empty-list fallback would read that
  // as 'nothing to clean' and hide the logout, so say what came back instead.
  if (!Array.isArray(result?.data_view)) {
    throw new Error(
      `api/data_views did not answer with { data_view: [...] } for ${account}${group ? ` in ${group}` : ''}. ` +
        `Body: ${describeBody(result)}`
    );
  }

  for (const dataView of result.data_view) {
    console.log(`Remove ${dataView.id} saved object for ${account}`);
    await deleteDataView(dataView.id, credentials, group);
  }
}
