import * as semver from 'semver';
import { DataViews, DirectKibanaRequest, GetObject } from '../support/page-objects/DirectKibanaRequest';
import { getKibanaVersion } from '../support/helpers';

describe('Direct kibana request', () => {
  const user = 'user1:dev';

  afterEach(() => {
    const clearDirectKibanaRequestState = () => {
      DirectKibanaRequest.deleteSavedObjects(user);
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        DirectKibanaRequest.deleteDataViews(user);
      }
    };

    clearDirectKibanaRequestState();
  });

  it('should check direct kibana request', () => {
    const verifySavedObjects = () => {
      DirectKibanaRequest.deleteSavedObjects(user);

      cy.log('Import saved objects for user1');
      cy.import({
        url: `${Cypress.config().baseUrl}/api/saved_objects/_import?overwrite=true`,
        filename: 'cypress/fixtures/file.ndjson',
        user
      });

      cy.log('Get imported saved objects for user1 Administrators group');
      cy.getRequest({
        url: DirectKibanaRequest.getObjectsUrl(),
        user
      }).then((result: GetObject) => {
        expect(result.saved_objects[0].id).equal('my-pattern');
        expect(result.saved_objects[1].id).equal('my-dashboard');
      });

      cy.log('Get imported saved objects for admin Administrators group');
      cy.getRequest({
        url: DirectKibanaRequest.getObjectsUrl()
      }).then((result: GetObject) => {
        expect(result.saved_objects[0].id).equal('my-pattern');
        expect(result.saved_objects[1].id).equal('my-dashboard');
        expect(result.saved_objects).to.have.length(2);
      });

      cy.log('Get imported saved objects for user1 infosec group');
      cy.getRequest({
        url: DirectKibanaRequest.getObjectsUrl(),
        user,
        header: 'x-ror-current-group: infosec_group'
      }).then((result: GetObject) => {
        const actual = result.saved_objects.some(
          saved_object => saved_object.id === 'my-pattern' || saved_object.id === 'my-dashboard'
        );
        // eslint-disable-next-line no-unused-expressions
        expect(actual).to.be.false;
      });
    };

    const verifyDataViews = () => {
      DirectKibanaRequest.deleteDataViews(user);
      cy.log('Create data_views for user1 Administrators group');
      cy.post({
        url: `${Cypress.config().baseUrl}/api/data_views/data_view`,
        payload: {
          data_view: {
            id: 'logstash',
            title: 'logstash-*',
            name: 'My Logstash Data View'
          }
        }
      });

      cy.log('get all data_views for user1 infosec group');
      cy.getRequest({
        url: `${Cypress.config().baseUrl}/api/data_views`,
        header: 'x-ror-current-group: infosec_group'
      }).then((result: DataViews) => {
        const actual = result.data_view.some(saved_object => saved_object.id === 'logstash');
        // eslint-disable-next-line no-unused-expressions
        expect(actual).to.be.false;
      });
    };

    verifySavedObjects();
    if (semver.gte(getKibanaVersion(), '8.0.0')) {
      verifyDataViews();
    }
  });
});
