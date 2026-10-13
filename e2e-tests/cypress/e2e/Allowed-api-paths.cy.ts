/* Copyright (C) Beshu Limited t/a ReadonlyREST Security - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Beshu Limited <info@readonlyrest.com> in London, UK
 */

import { rorApiClient } from '../support/helpers/RorApiClient';
import { Settings } from '../support/page-objects/Settings';
import { BasicCredentials } from '../support/helpers/credentials';

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
    it('allows calls to /internal/ paths matching the allowed_api_paths entry', () => {
      expectActiveSpaceIsDefault('internal/spaces/_active_space', apiOnlyInternalUser);
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

function apiGet(endpoint: string, credentials: BasicCredentials) {
  return cy.kbnGet({ endpoint, credentials, failOnStatusCode: false });
}

// ROR 403 is a specific body shape from guardKibanaApiPath; any other status means ROR let the request through
function assertRor403(response: unknown) {
  expect(response).to.have.property('status_code', 403);
  expect(response).to.have.property('status', 'forbidden');
}

function expectBlocked(endpoint: string, credentials: BasicCredentials) {
  return apiGet(endpoint, credentials).then(assertRor403);
}

// The status and the content type tell Kibana's JSON answer from a redirect to the login page or a
// text error, which carry no status code in the body.
function expectJsonAnswer<T>(
  endpoint: string,
  credentials: BasicCredentials,
  status: number,
  headers?: { [key: string]: string }
) {
  return cy
    .kbnResponse<T>({ endpoint, credentials, headers })
    .then(response => {
      const shown = `${response.status} ${JSON.stringify(response.body)}`;
      expect(response.status, `GET ${endpoint} status: ${shown}`).to.equal(status);
      expect(response.headers['content-type'], `GET ${endpoint} content type`).to.include('application/json');
    })
    .its('body');
}

function expectSpacesIncludeDefault(
  endpoint: 'api/spaces/space' | 's/default/api/spaces/space',
  credentials: BasicCredentials
) {
  expectJsonAnswer<Array<{ id: string }>>(endpoint, credentials, 200).then(spaces => {
    expect(spaces.map(space => space.id)).to.include('default');
  });
}

function expectTenantsList(endpoint: string, credentials: BasicCredentials) {
  expectJsonAnswer<{ tenants?: unknown }>(endpoint, credentials, 200).then(body => {
    expect(body.tenants, 'tenants').to.be.an('array');
  });
}

// Kibana 9 serves an /internal/ route only to a request that names Kibana as its origin, as the
// Kibana UI does.
function expectActiveSpaceIsDefault(endpoint: 'internal/spaces/_active_space', credentials: BasicCredentials) {
  expectJsonAnswer<{ id: string }>(endpoint, credentials, 200, { 'x-elastic-internal-origin': 'Kibana' }).then(
    space => {
      expect(space.id, 'active space').to.equal('default');
    }
  );
}
