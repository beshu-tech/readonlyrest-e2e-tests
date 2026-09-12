import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { configureRorIndexMainSettings } from './api-clients.js';
import { describeBody, kbnGet } from './http-client.js';

// api_only users — allowed_api_paths enforcement is active
const apiOnlyExactUser = 'api_only_restricted_user:dev';
const apiOnlyRegexpUser = 'api_only_restricted_regexp_user:dev';
const apiOnlySpaceUser = 'api_only_space_restricted_user:dev';
const apiOnlyInternalUser = 'api_only_internal_user:dev';
const apiOnlyRorUser = 'api_only_ror_user:dev';

describe('allowed_api_paths enforcement for api_only users', () => {
  before(() => configureRorIndexMainSettings('allowedApiPathsSettings.yaml'));
  after(() => configureRorIndexMainSettings('defaultSettings.yaml'));

  describe('exact /api/ path', () => {
    it('allows direct API calls to paths listed in allowed_api_paths', async () => {
      expectSpacesResponseIncludesDefault(await apiGet('api/spaces/space', apiOnlyExactUser));
    });

    it('blocks direct API calls to paths not listed in allowed_api_paths', async () => {
      await expectBlocked('api/saved_objects/_find?type=index-pattern', apiOnlyExactUser);
    });
  });

  describe('regexp /api/ path', () => {
    it('allows API calls to any path matching the regexp in allowed_api_paths', async () => {
      expectSpacesResponseIncludesDefault(await apiGet('api/spaces/space', apiOnlyRegexpUser));
    });

    it('blocks API calls to paths not matching the regexp in allowed_api_paths', async () => {
      await expectBlocked('api/saved_objects/_find?type=index-pattern', apiOnlyRegexpUser);
    });
  });

  describe('space-aware /api/ path', () => {
    it('allows API calls to the exact space-prefixed path listed in allowed_api_paths', async () => {
      expectSpacesResponseIncludesDefault(await apiGet('s/default/api/spaces/space', apiOnlySpaceUser));
    });

    it('blocks API calls to the root /api/ form when only a space-prefixed pattern is configured', async () => {
      await expectBlocked('api/spaces/space', apiOnlySpaceUser);
    });

    it('blocks API calls to a different space when only /s/default/ is listed in allowed_api_paths', async () => {
      await expectBlocked('s/other/api/spaces/space', apiOnlySpaceUser);
    });
  });

  describe('Kibana internal /internal/ paths', () => {
    // FIXME: Kibana does not serve /internal/spaces/get_all — it answers 404 on every version in the
    // matrix. The call still proves the allowlist let it past ReadonlyREST (a blocked request comes
    // back as ROR's forbidden envelope, not as Kibana's 404), which is why this asserts only that.
    // Point it at an /internal/ route that exists and it can use expectAllowed like the rest.
    it('allows calls to /internal/ paths matching the allowed_api_paths entry', async () => {
      await expectNotBlocked('internal/spaces/get_all', apiOnlyInternalUser);
    });

    it('blocks calls to /internal/ paths not listed in allowed_api_paths', async () => {
      await expectBlocked('internal/kibana/settings', apiOnlyInternalUser);
    });

    it('blocks calls to /api/ paths when only an /internal/ path is in allowed_api_paths', async () => {
      await expectBlocked('api/spaces/space', apiOnlyInternalUser);
    });
  });

  describe('ReadonlyREST public API /api/ror/ paths', () => {
    it('allows calls to /api/ror/ paths matching the allowed_api_paths entry', async () => {
      await expectAllowed('api/ror/user/tenants', apiOnlyRorUser);
    });

    it('blocks calls to /api/ror/ paths not listed in allowed_api_paths', async () => {
      // apiOnlyExactUser only allows /api/spaces/space — /api/ror/ is not in the allowlist
      await expectBlocked('api/ror/user/tenants', apiOnlyExactUser);
    });

    it('blocks calls to /api/spaces/ paths when only /api/ror/ is in allowed_api_paths', async () => {
      await expectBlocked('api/spaces/space', apiOnlyRorUser);
    });
  });
});

// --- Helpers ---

// These requests run with failOnStatusCode: false, so this file judges the outcome itself and needs
// the HTTP status to do it: a failed request can answer with a login page or a plain-text error,
// and neither body carries a code. So this caller asks for { status, body }.
function apiGet(endpoint, credentials) {
  return kbnGet({ endpoint, credentials, failOnStatusCode: false, withStatus: true });
}

// ROR 403 is a specific body shape from guardKibanaApiPath; any other status means ROR let the request through
function assertRor403({ body }) {
  const envelope = bodyOf(body);
  const shown = describeBody(body);

  assert.equal(envelope.status_code, 403, `expected ReadonlyREST's forbidden envelope, got: ${shown}`);
  assert.equal(envelope.status, 'forbidden', `expected ReadonlyREST's forbidden envelope, got: ${shown}`);
}

// Only that ReadonlyREST let the request reach Kibana. It says nothing about what Kibana then did
// with it, so prefer assertRequestSucceeded wherever the endpoint actually serves something.
function assertNotBlockedByRor({ body }) {
  assert.notEqual(bodyOf(body).status, 'forbidden', `ReadonlyREST blocked the request: ${describeBody(body)}`);
}

// Both halves of the answer. The status says the request succeeded, which no body can say on its
// own; the body says ReadonlyREST did not block it, which the status cannot — ReadonlyREST's own API
// answers /api/ror/user/tenants with { statusCode: 200, status: 'SUCCESS', ... }.
function assertRequestSucceeded(response) {
  assertNotBlockedByRor(response);
  assert.ok(
    response.status < 400,
    `the request did not succeed: HTTP ${response.status}; Body: ${describeBody(response.body)}`
  );
}

// A body that is not an object carries no status field, which is the same answer an object without
// one gives.
function bodyOf(body) {
  return body !== null && typeof body === 'object' ? body : {};
}

async function expectBlocked(endpoint, credentials) {
  assertRor403(await apiGet(endpoint, credentials));
}

async function expectAllowed(endpoint, credentials) {
  assertRequestSucceeded(await apiGet(endpoint, credentials));
}

async function expectNotBlocked(endpoint, credentials) {
  assertNotBlockedByRor(await apiGet(endpoint, credentials));
}

function expectSpacesResponseIncludesDefault(response) {
  assertRequestSucceeded(response);
  const spaces = response.body;
  assert.ok(
    Array.isArray(spaces) && spaces.map(space => space.id).includes('default'),
    `expected the default space in the response, got: ${describeBody(spaces)}`
  );
}
