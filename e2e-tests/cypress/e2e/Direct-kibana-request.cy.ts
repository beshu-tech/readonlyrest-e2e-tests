import * as semver from 'semver';
import { getKibanaVersion, userCredentials } from '../support/helpers';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';

describe('Direct kibana request', () => {
  const user = 'user1:dev';

  afterEach(() => {
    const clearDirectKibanaRequestState = () => {
      kbnApiAdvancedClient.deleteSavedObjects(user);
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        kbnApiAdvancedClient.deleteDataViews(user);
      }
    };

    clearDirectKibanaRequestState();
  });

  it('should check direct kibana request', () => {
    const verifySavedObjects = () => {
      kbnApiAdvancedClient.deleteSavedObjects(user);

      cy.log('Import saved objects for user1');
      cy.kbnImport({
        endpoint: "api/saved_objects/_import?overwrite=true",
        credentials: user,
        filename: 'cypress/fixtures/file.ndjson'
      });

      cy.log('Get imported saved objects for user1 Administrators group');
      kbnApiAdvancedClient.getSavedObjects(user).then(result => {
        expect(result.saved_objects[0].id).equal('my-pattern');
        expect(result.saved_objects[1].id).equal('my-dashboard');
      })

      cy.log('Get imported saved objects for admin Administrators group');
      kbnApiAdvancedClient
        .getSavedObjects(userCredentials)
        .then(result => {
          expect(result.saved_objects[0].id).equal('my-pattern');
          expect(result.saved_objects[1].id).equal('my-dashboard');
          expect(result.saved_objects).to.have.length(2);
        });

      cy.log('Get imported saved objects for user1 infosec group');
      kbnApiAdvancedClient.getSavedObjects(user, "infosec_group")
        .then(result => {
          const actual = result.saved_objects.some(
            saved_object => saved_object.id === 'my-pattern' || saved_object.id === 'my-dashboard'
          );
          // eslint-disable-next-line no-unused-expressions
          expect(actual).to.be.false;
        });
    };

    const verifyDataViews = () => {
      kbnApiAdvancedClient.deleteDataViews(user);
      cy.log('Create data_views for user1 Administrators group');
      kbnApiAdvancedClient.createDataView(
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
      kbnApiAdvancedClient
        .getDataViews(userCredentials, "infosec_group")
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
