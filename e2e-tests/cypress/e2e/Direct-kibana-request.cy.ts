import * as semver from 'semver';
import { getKibanaVersion } from '../support/helpers';
import { SmartKbnApiClient } from '../support/helpers/SmartKbnApiClient';
import { use } from 'chai';

describe('Direct kibana request', () => {
  const user = 'user1:dev';

  afterEach(() => {
    const clearDirectKibanaRequestState = () => {
      SmartKbnApiClient.instance.deleteSavedObjects(user);
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        SmartKbnApiClient.instance.deleteDataViews(user);
      }
    };

    clearDirectKibanaRequestState();
  });

  it('should check direct kibana request', () => {
    const verifySavedObjects = () => {
      SmartKbnApiClient.instance.deleteSavedObjects(user);

      cy.log('Import saved objects for user1');
      cy.kbnImport({
        endpoint: "api/saved_objects/_import?overwrite=true",
        credentials: user,
        filename: 'cypress/fixtures/file.ndjson'
      });

      cy.log('Get imported saved objects for user1 Administrators group');
      SmartKbnApiClient.instance.getSavedObjects(user).then(result => {
        expect(result.saved_objects[0].id).equal('my-pattern');
        expect(result.saved_objects[1].id).equal('my-dashboard');
      })

      cy.log('Get imported saved objects for admin Administrators group');
      SmartKbnApiClient.instance
        .getSavedObjects(`${Cypress.env().login}:${Cypress.env().password}`)
        .then(result => {
          expect(result.saved_objects[0].id).equal('my-pattern');
          expect(result.saved_objects[1].id).equal('my-dashboard');
          expect(result.saved_objects).to.have.length(2);
        });

      cy.log('Get imported saved objects for user1 infosec group');
      SmartKbnApiClient.instance.getSavedObjects(user, "infosec_group")
        .then(result => {
          const actual = result.saved_objects.some(
            saved_object => saved_object.id === 'my-pattern' || saved_object.id === 'my-dashboard'
          );
          // eslint-disable-next-line no-unused-expressions
          expect(actual).to.be.false;
        });
    };

    const verifyDataViews = () => {
      SmartKbnApiClient.instance.deleteDataViews(user);
      cy.log('Create data_views for user1 Administrators group');
      SmartKbnApiClient.instance.createDataView(
        {
          data_view: {
            id: 'logstash',
            title: 'logstash-*',
            name: 'My Logstash Data View'
          }
        },
        user
      );

      cy.log('get all data_views for user1 infosec group');
      SmartKbnApiClient.instance
        .getDataViews(`${Cypress.env().login}:${Cypress.env().password}`, "infosec_group")
        .then(result => {
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
