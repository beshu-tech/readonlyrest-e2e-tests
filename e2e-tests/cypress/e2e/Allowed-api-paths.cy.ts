/* Copyright (C) Beshu Limited t/a ReadonlyREST Security - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Beshu Limited <info@readonlyrest.com> in London, UK
 */

import { rorApiClient } from '../support/helpers/RorApiClient';
import { Settings } from '../support/page-objects/Settings';

// api_only users — allowed_api_paths enforcement is active
const apiOnlyExactUser = 'api_only_restricted_user:dev';
const apiOnlyRegexpUser = 'api_only_restricted_regexp_user:dev';
const apiOnlySpaceUser = 'api_only_space_restricted_user:dev';
const apiOnlyInternalUser = 'api_only_internal_user:dev';
const apiOnlyRorUser = 'api_only_ror_user:dev';

describe('allowed_api_paths enforcement for api_only users', () => {
  before(() => rorApiClient.configureRorIndexMainSettings('allowedApiPathsSettings.yaml'));
  after(() => Settings.restoreDefaultSettings());

  describe('exact /api/ path', () => {
    it('allows direct API calls to paths listed in allowed_api_paths', () => {
      expectSpacesIncludeDefault('api/spaces/space', apiOnlyExactUser);
    });

    it('blocks direct API calls to paths not listed in allowed_api_paths', () => {
      expectBlocked('api/saved_objects/_find?type=index-pattern', apiOnlyExactUser);
    });
  });

  describe('regexp /api/ path', () => {
    it('allows API calls to any path matching the regexp in allowed_api_paths', () => {
      expectSpacesIncludeDefault('api/spaces/space', apiOnlyRegexpUser);
    });

    it('blocks API calls to paths not matching the regexp in allowed_api_paths', () => {
      expectBlocked('api/saved_objects/_find?type=index-pattern', apiOnlyRegexpUser);
    });
  });

  describe('space-aware /api/ path', () => {
    it('allows API calls to the exact space-prefixed path listed in allowed_api_paths', () => {
      expectSpacesIncludeDefault('s/default/api/spaces/space', apiOnlySpaceUser);
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
    // matrix. Kibana's JSON 404 still proves the allowlist let it past ReadonlyREST: a blocked request
    // comes back as ROR's 403. Point it at an /internal/ route that exists and it can check a 200.
    it('allows calls to /internal/ paths matching the allowed_api_paths entry', () => {
      expectKibanaNotFound('internal/spaces/get_all', apiOnlyInternalUser);
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
      expectTenantsList('api/ror/user/tenants', apiOnlyRorUser);
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

function expectBlocked(endpoint: string, credentials: string) {
  return apiGet(endpoint, credentials).then(assertRor403);
}

// The status and the content type tell Kibana's JSON answer from a redirect to the login page or a
// text error, which carry no status code in the body.
function expectJsonAnswer<T>(endpoint: string, credentials: string, status: number) {
  return cy
    .kbnResponse<T>({ endpoint, credentials })
    .then(response => {
      const shown = `${response.status} ${JSON.stringify(response.body)}`;
      expect(response.status, `GET ${endpoint} status: ${shown}`).to.equal(status);
      expect(response.headers['content-type'], `GET ${endpoint} content type`).to.include('application/json');
    })
    .its('body');
}

function expectSpacesIncludeDefault(endpoint: string, credentials: string) {
  expectJsonAnswer<Array<{ id: string }>>(endpoint, credentials, 200).then(spaces => {
    expect(spaces.map(space => space.id)).to.include('default');
  });
}

function expectTenantsList(endpoint: string, credentials: string) {
  expectJsonAnswer<{ tenants?: unknown }>(endpoint, credentials, 200).then(body => {
    expect(body.tenants, 'tenants').to.be.an('array');
  });
}

function expectKibanaNotFound(endpoint: string, credentials: string) {
  expectJsonAnswer<{ statusCode?: number }>(endpoint, credentials, 404).then(body => {
    expect(body.statusCode, 'status code in the Kibana answer').to.equal(404);
  });
}
