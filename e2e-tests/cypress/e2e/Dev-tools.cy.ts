import * as semver from 'semver';
import { Login } from '../support/page-objects/Login';
import { DevTools } from '../support/page-objects/DevTools';
import { getKibanaVersion } from '../support/helpers';

describe('Dev tools', () => {
  beforeEach(() => {
    Login.initialization();
    DevTools.openDevTools();
  });

  it('should check dev tools', () => {
    cy.log('should verify POST _doc write request forbidden with 403 status');
    DevTools.sendRequest('POST /xx-enrich-iis/_doc\n{ "field": "value" }');
    DevTools.verifyResponseStatus(403, 'Forbidden');

    cy.log('should verify GET /_index_template successful with 200 status');
    DevTools.sendRequest('GET /_index_template/');
    DevTools.verifyResponseStatus(200, 'OK');

    cy.log('should verify POST .kibana/_search successful with 200 status');
    DevTools.sendRequest('POST .kibana/_search');
    DevTools.verifyResponseStatus(200, 'OK');

    cy.log('should verify GET _search successful with 200 status');
    DevTools.sendRequest('GET _search\n{\n  "query": {\n    "match_all": {}\n  }\n}');
    DevTools.verifyResponseStatus(200, 'OK');

    cy.log('should verify GET _search with bad JSON is rejected');
    const badJsonRequest = 'GET _search\n{\n  "query": { BAD_JSON\n    "match_all": {}\n  }\n}';
    if (semver.satisfies(getKibanaVersion(), '>=8.19.0 <9.0.0 || >=9.1.0')) {
      DevTools.trySendRequest(badJsonRequest);
      DevTools.verifyIfContainsErrorsMessage();
    } else {
      DevTools.sendRequest(badJsonRequest);
      DevTools.verifyResponseStatus(400, 'Bad Request');
    }

    cy.log('should verify whether .kibana index is not tweaked');
    DevTools.sendRequest('GET .kibana');
    DevTools.verifyResponseStatus(200, 'OK');
    DevTools.verifyResponseInConsole(`.kibana_${getKibanaVersion()}_001`);
  });
});
