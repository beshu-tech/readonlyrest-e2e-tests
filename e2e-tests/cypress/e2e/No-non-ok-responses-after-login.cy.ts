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

describe('No unexpected non-ok responses after login', () => {
  it('should not produce non-ok HTTP responses when loading Kibana after login', () => {
    const nonOkResponses: Array<{ url: string; status: number }> = [];

    cy.intercept('**', req => {
      req.on('response', res => {
        const isLocalRequest = new URL(req.url).hostname === 'localhost';
        if (isLocalRequest && res.statusCode >= 400 && !ENDPOINTS_IGNORED_BY_ROR.some(endpoint => req.url.includes(endpoint))) {
          nonOkResponses.push({ url: req.url, status: res.statusCode });
        }
      });
    });

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
