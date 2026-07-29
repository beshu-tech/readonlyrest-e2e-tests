/* Copyright (C) Beshu Limited t/a ReadonlyREST Security - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Beshu Limited <info@readonlyrest.com> in London, UK
 */

import { Login } from '../support/page-objects/Login';

// Kibana endpoints that return non-ok responses in a ROR-managed installation because
// they belong to Kibana's native security or cloud layers, which ROR replaces or does not support.
const ENDPOINTS_IGNORED_BY_ROR = [
  '/internal/cloud_connect/cluster_details', // cloud cluster metadata — not available in non-Elastic-Cloud deployments
  '/api/exception_lists/items/_find' // Elastic Endpoint Security (X-Pack) — not supported by ROR
];

// A route handler makes Cypress proxy and buffer every matching response. Matching '**' would put
// all of Kibana's JS bundles through it, which is slow enough to skew the very page load being
// measured and heavy enough to risk exhausting the Electron renderer. These three prefixes cover
// the API surface ROR sits in front of — including everything in ENDPOINTS_IGNORED_BY_ROR — and
// leave static assets alone.
const WATCHED_PATHS = ['**/api/**', '**/internal/**', '**/pkp/**'];

describe('No unexpected non-ok responses after login', () => {
  it('should not produce non-ok HTTP responses when loading Kibana after login', () => {
    const nonOkResponses: Array<{ url: string; status: number }> = [];

    // Handler written inline so `req` and `res` are typed by cy.intercept's own signature —
    // CyHttpMessages is exported from cypress/types/net-stubbing rather than declared globally, so
    // there is no name to annotate a hoisted handler with.
    WATCHED_PATHS.forEach(path =>
      cy.intercept(path, req =>
        req.on('response', res => {
          const isLocalRequest = new URL(req.url).hostname === 'localhost';
          const isIgnored = ENDPOINTS_IGNORED_BY_ROR.some(endpoint => req.url.includes(endpoint));
          if (isLocalRequest && res.statusCode >= 400 && !isIgnored) {
            nonOkResponses.push({ url: req.url, status: res.statusCode });
          }
        })
      )
    );

    Login.initialization();

    // req.on('response') fires outside Cypress's command queue — Kibana has long-running
    // connections (SSE, websocket polling) so we cannot wait for pendingCount===0;
    // a fixed wait is the only practical option here
    cy.wait(3000);

    cy.wrap(null).then(() => {
      expect(nonOkResponses, `unexpected non-ok responses: ${JSON.stringify(nonOkResponses, null, 2)}`).to.be.empty;
    });
  });
});
