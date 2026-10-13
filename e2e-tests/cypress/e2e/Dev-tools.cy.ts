import { Login } from '../support/page-objects/Login';
import { DevTools } from '../support/page-objects/DevTools';
import { getKibanaVersion, kibanaVersion } from '../support/helpers';

describe('Dev tools', () => {
  beforeEach(() => {
    Login.initialization();
    DevTools.openDevTools();
  });

  it('should check dev tools', () => {
    cy.log('should verify POST _doc write request forbidden with 403 status');
    DevTools.sendRequest('POST /xx-enrich-iis/_doc\n{ "field": "value" }').should('equal', 403);
    DevTools.verifyStatusShown(403, 'Forbidden');

    cy.log('should verify GET /_index_template successful with 200 status');
    DevTools.sendRequest('GET /_index_template/').should('equal', 200);
    DevTools.verifyStatusShown(200, 'OK');

    cy.log('should verify POST .kibana/_search successful with 200 status');
    DevTools.sendRequest('POST .kibana/_search').should('equal', 200);
    DevTools.verifyStatusShown(200, 'OK');

    cy.log('should verify GET _search successful with 200 status');
    DevTools.sendRequest('GET _search\n{\n  "query": {\n    "match_all": {}\n  }\n}').should('equal', 200);
    DevTools.verifyStatusShown(200, 'OK');

    cy.log('should verify GET _search with bad JSON is rejected');
    const badJsonRequest = 'GET _search\n{\n  "query": { BAD_JSON\n    "match_all": {}\n  }\n}';
    // Kibana 8.19 and 9.1 and later do not send a request with errors. They show a toast instead.
    if (kibanaVersion.is819OrFrom91()) {
      DevTools.sendRequestWithErrors(badJsonRequest);
    } else {
      DevTools.sendRequest(badJsonRequest).should('equal', 400);
      DevTools.verifyStatusShown(400, 'Bad Request');
    }

    cy.log('should verify whether .kibana index is not tweaked');
    DevTools.sendRequest('GET .kibana').should('equal', 200);
    DevTools.verifyStatusShown(200, 'OK');
    DevTools.verifyResponseInConsole(`.kibana_${getKibanaVersion()}_001`);
  });
});
