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
    cy.log('should verify POST _bulk request forbidden with 403 status');
    DevTools.sendRequest(
      'POST /xx-enrich-iis/_bulk {enter} {{} "index" : {{} {}} {}} {enter} {{} "index" : {{} {}} {}}'
    );
    DevTools.verifyIf403Status();

    cy.log('should verify GET /_index_template successful with 403 status');
    DevTools.sendRequest('GET /_index_template/');
    DevTools.verifyIf200Status();

    cy.log('should verify POST .kibana/_search successful with 200 status');
    DevTools.sendRequest('POST .kibana/_search');
    DevTools.verifyIf200Status();

    cy.log('should verify GET _search successful with 200 status');
    DevTools.sendRequest('GET _search {enter} {{} {enter} "query": {{} {enter} "match_all": {{}} {enter} } } ');
    DevTools.verifyIf200Status();

    cy.log('should verify GET _search successful with 200 status');
    DevTools.sendRequest(
      'GET _search {enter} {{} {enter} "query": {{} BAD_JSON {enter} "match_all": {{}} {enter} } } '
    );

    if (semver.satisfies(getKibanaVersion(), '>=8.19.0 <9.0.0 || >=9.1.0')) {
      DevTools.verifyIfContainsErrorsMessage();
    } else {
      DevTools.verifyIf400Status();
    }

    cy.log('should verify whether .kibana index is not tweaked');
    DevTools.sendRequest('GET .kibana');
    DevTools.verifyResponseInConsole(`.kibana_${getKibanaVersion()}_001`);
  });
});
