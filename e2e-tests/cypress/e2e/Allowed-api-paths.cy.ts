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
    it('allows calls to /internal/ paths matching the allowed_api_paths entry', () => {
      expectAllowed('internal/spaces/get_all', apiOnlyInternalUser);
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

// The requests run with failOnStatusCode: false and kbnGet yields the body only, so the status code
// is not visible here — the body shape is. A successful call yields the resource itself; every
// failure yields a JSON error envelope instead: ROR uses { status_code, status }, Kibana core uses
// { statusCode, error, message }. Asserting that neither envelope is present is what makes this
// "the call went through and was answered" rather than the much weaker "ROR did not return its own
// 403", which a 404 or a 500 would satisfy just as well.
function assertRequestSucceeded(response: unknown) {
  const body = response as Record<string, unknown> | null;
  const shown = JSON.stringify(body);

  expect(body, 'expected a response body, got none').to.not.be.null;
  expect(body, `ReadonlyREST blocked the request: ${shown}`).to.not.have.property('status', 'forbidden');
  expect(body, `ReadonlyREST returned an error: ${shown}`).to.not.have.property('status_code');
  expect(body, `Kibana returned an error: ${shown}`).to.not.have.property('statusCode');
}

function expectBlocked(endpoint: string, credentials: string) {
  return apiGet(endpoint, credentials).then(assertRor403);
}

function expectAllowed(endpoint: string, credentials: string) {
  return apiGet(endpoint, credentials).then(assertRequestSucceeded);
}

function expectSpacesResponseIncludesDefault(response: unknown) {
  const spaces = response as Array<{ id: string }>;
  expect(spaces.map(s => s.id)).to.include('default');
}
