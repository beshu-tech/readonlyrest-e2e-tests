import * as semver from 'semver';
import { getKibanaVersion, userCredentials } from '../support/helpers';
import { KbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { use } from 'chai';

describe('Direct kibana request', () => {
  const user = 'user1:dev';

  afterEach(() => {
    const clearDirectKibanaRequestState = () => {
      KbnApiAdvancedClient.instance.deleteSavedObjects(user);
      if (semver.gte(getKibanaVersion(), '8.0.0')) {
        KbnApiAdvancedClient.instance.deleteDataViews(user);
      }
    };

    clearDirectKibanaRequestState();
  });

  it('should check direct kibana request', () => {
    const verifySavedObjects = () => {
      KbnApiAdvancedClient.instance.deleteSavedObjects(user);

      cy.log('Import saved objects for user1');
      cy.kbnImport({
        endpoint: "api/saved_objects/_import?overwrite=true",
        credentials: user,
        filename: 'cypress/fixtures/file.ndjson'
      });

      cy.log('Get imported saved objects for user1 Administrators group');
      KbnApiAdvancedClient.instance.getSavedObjects(user).then(result => {
        expect(result.saved_objects[0].id).equal('my-pattern');
        expect(result.saved_objects[1].id).equal('my-dashboard');
      })

      cy.log('Get imported saved objects for admin Administrators group');
      KbnApiAdvancedClient.instance
        .getSavedObjects(userCredentials)
        .then(result => {
          expect(result.saved_objects[0].id).equal('my-pattern');
          expect(result.saved_objects[1].id).equal('my-dashboard');
          expect(result.saved_objects).to.have.length(2);
        });

      cy.log('Get imported saved objects for user1 infosec group');
      KbnApiAdvancedClient.instance.getSavedObjects(user, "infosec_group")
        .then(result => {
          const actual = result.saved_objects.some(
            saved_object => saved_object.id === 'my-pattern' || saved_object.id === 'my-dashboard'
          );
          // eslint-disable-next-line no-unused-expressions
          expect(actual).to.be.false;
        });
    };

    const verifyDataViews = () => {
      KbnApiAdvancedClient.instance.deleteDataViews(user);
      cy.log('Create data_views for user1 Administrators group');
      KbnApiAdvancedClient.instance.createDataView(
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
      KbnApiAdvancedClient.instance
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
