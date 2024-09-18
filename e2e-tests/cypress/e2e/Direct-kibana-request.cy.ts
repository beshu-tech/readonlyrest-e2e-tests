import * as semver from 'semver';
import { DataViews, GetObject } from '../support/helpers/SmartKbnClient';
import { getKibanaVersion } from '../support/helpers';
import { SmartKbnClient } from '../support/helpers/SmartKbnClient';
import { use } from 'chai';

describe('Direct kibana request', () => {
  const user = 'user1:dev';

  afterEach(() => {
    const clearDirectKibanaRequestState = () => {
      SmartKbnClient.deleteSavedObjects(user);
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        SmartKbnClient.deleteDataViews(user);
      }
    };

    clearDirectKibanaRequestState();
  });

  it('should check direct kibana request', () => {
    const verifySavedObjects = () => {
      SmartKbnClient.deleteSavedObjects(user);

      cy.log('Import saved objects for user1');
      cy.kbnImport({
        endpoint: "api/saved_objects/_import?overwrite=true",
        credentials: user,
        filename: 'cypress/fixtures/file.ndjson'
      });

      cy.log('Get imported saved objects for user1 Administrators group');
      cy
        .kbnGet({
          endpoint: SmartKbnClient.getObjectEndpoint(),
          credentials: user
        })
        .then((result: GetObject) => {
          expect(result.saved_objects[0].id).equal('my-pattern');
          expect(result.saved_objects[1].id).equal('my-dashboard');
        });

      cy.log('Get imported saved objects for admin Administrators group');
      cy
        .kbnGet({
          endpoint: SmartKbnClient.getObjectEndpoint(),
          credentials: `${Cypress.env().login}:${Cypress.env().password}`
        })
        .then((result: GetObject) => {
          expect(result.saved_objects[0].id).equal('my-pattern');
          expect(result.saved_objects[1].id).equal('my-dashboard');
          expect(result.saved_objects).to.have.length(2);
        });

      cy.log('Get imported saved objects for user1 infosec group');
      cy
        .kbnGet({
          endpoint: SmartKbnClient.getObjectEndpoint(),
          credentials: user,
          currentGroupHeader: "infosec_group"
        })
        .then((result: GetObject) => {
          const actual = result.saved_objects.some(
            saved_object => saved_object.id === 'my-pattern' || saved_object.id === 'my-dashboard'
          );
          // eslint-disable-next-line no-unused-expressions
          expect(actual).to.be.false;
        });
    };

    const verifyDataViews = () => {
      SmartKbnClient.deleteDataViews(user);
      cy.log('Create data_views for user1 Administrators group');
      cy.kbnPost({
        endpoint: "api/data_views/data_view",
        credentials: `${Cypress.env().login}:${Cypress.env().password}`,
        payload: {
          data_view: {
            id: 'logstash',
            title: 'logstash-*',
            name: 'My Logstash Data View'
          }
        }
      });

      cy.log('get all data_views for user1 infosec group');
      cy
        .kbnGet({
          endpoint: "api/data_views",
          credentials: `${Cypress.env().login}:${Cypress.env().password}`,
          currentGroupHeader: "infosec_group"
        })
        .then((result: DataViews) => {
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
