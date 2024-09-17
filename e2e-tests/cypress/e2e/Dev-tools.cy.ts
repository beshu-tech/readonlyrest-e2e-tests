import { Login } from '../support/page-objects/Login';
import { DevTools } from '../support/page-objects/DevTools';

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
    DevTools.verifyIf403Status();

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
    DevTools.verifyIf400Status();
  });
});
