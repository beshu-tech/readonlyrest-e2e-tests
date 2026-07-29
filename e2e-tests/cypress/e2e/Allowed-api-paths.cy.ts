/* Copyright (C) Beshu Limited t/a ReadonlyREST Security - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Beshu Limited <info@readonlyrest.com> in London, UK
 */

import { Login } from '../support/page-objects/Login';
import { rorApiClient } from '../support/helpers/RorApiClient';

// api_only users — allowed_api_paths enforcement is active
const apiOnlyExactUser = 'api_only_restricted_user:dev';
const apiOnlyRegexpUser = 'api_only_restricted_regexp_user:dev';
const apiOnlySpaceUser = 'api_only_space_restricted_user:dev';
const apiOnlyInternalUser = 'api_only_internal_user:dev';
const apiOnlyRorUser = 'api_only_ror_user:dev';

describe('allowed_api_paths enforcement for api_only users', () => {
  before(() => rorApiClient.configureRorIndexMainSettings('allowedApiPathsSettings.yaml'));
  after(() => rorApiClient.configureRorIndexMainSettings('defaultSettings.yaml'));

  describe('exact /api/ path', () => {
    it('allows direct API calls to paths listed in allowed_api_paths', () => {
      apiGet('api/spaces/space', apiOnlyExactUser).then(expectSpacesResponseIncludesDefault);
    });

    it('blocks direct API calls to paths not listed in allowed_api_paths', () => {
      expectBlocked('api/saved_objects/_find?type=index-pattern', apiOnlyExactUser);
    });
  });

  describe('regexp /api/ path', () => {
    it('allows API calls to any path matching the regexp in allowed_api_paths', () => {
      apiGet('api/spaces/space', apiOnlyRegexpUser).then(expectSpacesResponseIncludesDefault);
    });

    it('blocks API calls to paths not matching the regexp in allowed_api_paths', () => {
      expectBlocked('api/saved_objects/_find?type=index-pattern', apiOnlyRegexpUser);
    });
  });

  describe('space-aware /api/ path', () => {
    it('allows API calls to the exact space-prefixed path listed in allowed_api_paths', () => {
      apiGet('s/default/api/spaces/space', apiOnlySpaceUser).then(expectSpacesResponseIncludesDefault);
    });

    it('blocks API calls to the root /api/ form when only a space-prefixed pattern is configured', () => {
      expectBlocked('api/spaces/space', apiOnlySpaceUser);
    });

    it('blocks API calls to a different space when only /s/default/ is listed in allowed_api_paths', () => {
      expectBlocked('s/other/api/spaces/space', apiOnlySpaceUser);
    });
  });

  describe('Kibana internal /internal/ paths', () => {
    // FIXME: Kibana does not serve /internal/spaces/get_all — it answers 404 on every version in the
    // matrix. The call still proves the allowlist let it past ReadonlyREST (a blocked request comes
    // back as ROR's forbidden envelope, not as Kibana's 404), which is why this asserts only that.
    // Point it at an /internal/ route that exists and it can use expectAllowed like the rest.
    it('allows calls to /internal/ paths matching the allowed_api_paths entry', () => {
      expectNotBlocked('internal/spaces/get_all', apiOnlyInternalUser);
    });

    it('blocks calls to /internal/ paths not listed in allowed_api_paths', () => {
      expectBlocked('internal/kibana/settings', apiOnlyInternalUser);
    });

    it('blocks calls to /api/ paths when only an /internal/ path is in allowed_api_paths', () => {
      expectBlocked('api/spaces/space', apiOnlyInternalUser);
    });
  });

  describe('ReadonlyREST public API /api/ror/ paths', () => {
    it('allows calls to /api/ror/ paths matching the allowed_api_paths entry', () => {
      expectAllowed('api/ror/user/tenants', apiOnlyRorUser);
    });

    it('blocks calls to /api/ror/ paths not listed in allowed_api_paths', () => {
      // apiOnlyExactUser only allows /api/spaces/space — /api/ror/ is not in the allowlist
      expectBlocked('api/ror/user/tenants', apiOnlyExactUser);
    });

    it('blocks calls to /api/spaces/ paths when only /api/ror/ is in allowed_api_paths', () => {
      expectBlocked('api/spaces/space', apiOnlyRorUser);
    });
  });
});

// --- Helpers ---

function apiGet(endpoint: string, credentials: string) {
  return cy.kbnGet({ endpoint, credentials, failOnStatusCode: false });
}

// ROR 403 is a specific body shape from guardKibanaApiPath; any other status means ROR let the request through
function assertRor403(response: unknown) {
  expect(response).to.have.property('status_code', 403);
  expect(response).to.have.property('status', 'forbidden');
}

// Only that ReadonlyREST let the request reach Kibana. It says nothing about what Kibana then did
// with it, so prefer assertRequestSucceeded wherever the endpoint actually serves something.
function assertNotBlockedByRor(response: unknown) {
  const body = response as Record<string, unknown> | null;
  expect(body, `ReadonlyREST blocked the request: ${JSON.stringify(body)}`).to.not.have.property('status', 'forbidden');
}

// The requests run with failOnStatusCode: false and kbnGet yields the body only, so the HTTP status
// is not visible here — whatever the body carries is. Both layers put a code in it on failure
// (ReadonlyREST as `status_code`, Kibana core as `statusCode`), but ReadonlyREST's own API also puts
// one there on success — /api/ror/user/tenants answers { statusCode: 200, status: 'SUCCESS', ... }.
// So it is the value that decides, not the presence of the field; a body with no code at all is the
// resource itself and therefore fine.
function assertRequestSucceeded(response: unknown) {
  const body = response as Record<string, unknown> | null;
  const shown = JSON.stringify(body);

  assertNotBlockedByRor(response);
  expect(statusCodeOf(body), `the request did not succeed: ${shown}`).to.be.lessThan(400);
}

function statusCodeOf(body: Record<string, unknown> | null): number {
  const code = body?.status_code ?? body?.statusCode;
  return typeof code === 'number' ? code : 200;
}

function expectBlocked(endpoint: string, credentials: string) {
  return apiGet(endpoint, credentials).then(assertRor403);
}

function expectAllowed(endpoint: string, credentials: string) {
  return apiGet(endpoint, credentials).then(assertRequestSucceeded);
}

function expectNotBlocked(endpoint: string, credentials: string) {
  return apiGet(endpoint, credentials).then(assertNotBlockedByRor);
}

function expectSpacesResponseIncludesDefault(response: unknown) {
  const spaces = response as Array<{ id: string }>;
  expect(spaces.map(s => s.id)).to.include('default');
}
