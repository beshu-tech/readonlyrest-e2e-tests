/* eslint-disable no-use-before-define */

import { esApiClient } from '../support/helpers/EsApiClient';
import { Tenancy } from '../support/page-objects/Tenancy';
import { KibanaNavigation } from '../support/page-objects/KibanaNavigation';
import { Discover } from '../support/page-objects/Discover';
import { kbnApiClient } from '../support/helpers/KbnApiClient';
import { getKibanaVersion, userCredentials } from '../support/helpers';
import { Login } from '../support/page-objects/Login';
import { RorMenu } from '../support/page-objects/RorMenu';
import semver from 'semver';

describe('Index Session', () => {
  beforeEach(() => {
    esApiClient.deleteIndex(SESSION_INDEX);
  });

  afterEach(() => {
    esApiClient.deleteIndex(SESSION_INDEX);
    kbnApiClient.deleteSampleData('ecommerce', userCredentials);
    kbnApiClient.deleteSampleData('ecommerce', userCredentials, 'template_group');
  });

  it('should set correct tenancy when reading session without schema from legacy plugin UI', () => {
    // Pre-load ecommerce sample data via API before visiting Discover so Kibana 9.x finds an
    // existing data view instead of defaulting to the system "discover-observability-solution-all-logs"
    // data view, which triggers aggressive background searches against non-existent indices and
    // causes OOM crashes in the Electron renderer.
    cy.on('uncaught:exception', () => false);

    esApiClient.addDocument(
      SESSION_INDEX,
      'e47bcdeb-42ee-4bbf-abbd-0c8ef441873f',
      LEGACY_SESSION_WITHOUT_SCHEMA_VERSION
    );

    kbnApiClient.loadSampleData('ecommerce', userCredentials, 'template_group');

    Login.suppressPostLoginNotices();

    Tenancy.disableTenancyOnUI().as('tenancyInjector');

    Login.visitWithSessionCookie(
      'Fe26.2**050ab422c684a30b847701b834f067b3f11b559e531dd98baa5240f5abbfdc7d*a43QH_Cgag1pzdZk0CBGVg*LydOiS2PVo7N6fkoE4hlJsP3sT7b9PTXitqv1-118vl9TAPRTA02SVVXaiT-3p5L**b7b4db60afdf4242f7ba00bd67fab1a703be8eb5b140ab2dec790d81d16aab74*osQ2UuVjt3cV__N1lioDCAIO47upc6degwd-XLHErXk',
      'https://localhost:5601/s/default/app/discover'
    );

    cy.wait('@tenancyInjector');
    cy.get('[data-test-subj=globalLoadingIndicator-hidden]', { timeout: 30000 }).should('be.visible');

    Tenancy.checkTenancyNameInBadge('template', 'rw');

    KibanaNavigation.openPage('Discover');
    if (semver.gte(getKibanaVersion(), '9.0.0')) {
      cy.intercept('POST', '/s/default/internal/search/ese**').as('dataViewSearch');
      Discover.selectDataView('Kibana Sample Data eCommerce');
      cy.wait('@dataViewSearch');
    } else if (semver.lt(getKibanaVersion(), '8.0.0')) {
      // Kibana 7.x: explicitly select the ecommerce index pattern to avoid stale Discover state
      cy.intercept('POST', '/s/default/internal/bsearch**').as('dataViewSearch');
      cy.get('[data-test-subj="indexPattern-switch-link"]').click();
      cy.findAllByText('kibana_sample_data_ecommerce').first().click();
      cy.wait('@dataViewSearch');
    }
    Discover.verifyDocumentWithTodayRange(0, 'kibana_sample_data_ecommerce');
  });

  it('should support legacy session format when creating a new session', () => {
    Login.initialization();

    esApiClient.documentsForIndex(SESSION_INDEX).then(result => {
      const session = result.hits.hits[0]._source;
      expect(session.currentGroup.id).to.eq('admins_group');
      expect(session.kibanaIndex).to.eq('.kibana_admins_group');
    });

    RorMenu.changeTenancy('Infosec');

    esApiClient.documentsForIndex(SESSION_INDEX).then(result => {
      const session = result.hits.hits[0]._source;
      expect(session.currentGroup.id).to.eq('infosec_group');
      expect(session.kibanaIndex).to.eq('.kibana_infosec_group');
    });
  });
});

const SESSION_INDEX = '.readonlyrest_kbn_sessions';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

const LEGACY_SESSION_WITHOUT_SCHEMA_VERSION = {
  availableGroups: [
    { id: 'admins_group', name: 'administrators' },
    { id: 'infosec_group', name: 'infosec' },
    { id: 'template_group', name: 'template' }
  ],
  correlationId: 'f933769a-7419-465a-9db4-1420d29f7fb9',
  currentGroup: { id: 'template_group', name: 'template' },
  customMetadata: { alert_message: 'Dear admin' },
  encryptedIdentitySessionHeaders:
    'U2FsdGVkX1/fqtxDmLhKvoekgdqi3rA2G3MWiwPanKpO068A+0ghMrb+/0xyokW5uMUMEo6YHxmPIBwdqYrXRZRUSRaJ0K1wLRzla25OSf1sRGBqpkedHzw0BwwCD2p95f+ZlKF3RVhEpsVIl886ed5we6pXWVBPPjCtBkGQOiewFtyuINWJMQnu3Ww2T8Z7y20al3tzYDTKMfkolWt6ibRT6V9HO1JbjFnRWEH0/hoor04NSV+urfNoLrDxfyGMKv5YrRFovMTGLW6QXh9ZEXKNBHXXMocU+l+yWuz245ohkQg34BebmC8j8L6TmbSAVQfUBW/j9+bKPXAoWtmZD9y7fgNCNBSzcQBc19EtzoGNuN+1MiMjr2g8YaAOYZCOu7VTCTyrsjjzfKSYLKZueJCMGV9seRUVeYojYfUHr1Od5byagQobxz4mhMK5AsQzxH1JLyEUzU2fqjL7I5inQX1xj28NPtwy9UwOKfGCniKf29tlCxVc/YBYjJ+1mmUHk/Zy6yJsBf1CIzCrgoumw1bzzaeuD/IRt4YqVqcyUB4O7ZjttZQHelmtO2b7iybrRBJMi/8ksPm8iH9RtlEXd+NzSibHaVGT6FZHQLVsutAT8j4mZAYgcWs3y6sUlTX+ZrZop717N33ZKlNG7wdtgt1ei+ZiTIZrl6ieNd4JYsDZ5gDXzTF+8HdzI+dSbFdPNpUTjj5OuUShFs1ZSR8VBEw9Ir00Fy5QZTax/WyDXjNrtrVExdI6R+QOQHt5CSgGkYOSolQz0jxKCPXVNH3jmU8JZzCBITQKJGVf6qUWsxWv+yPGMj26zfjB+fjplcG994YNL0xcIwGswuL1Qdj9E5e6dJdZaF6kUE2KCfxBXHSrhBrfnraHgTjWWx6ZvkF3zd642dd4aHvufWIChW2dq5stLrieRLhkXEbTLca3kw2ood846F1choK1KRYcOMdhgRezp7vNqen0zSXuIUgipRmPzonMrmyngCVEU+WYi8Ln7XRNwiHIc5nGx5S+cUbvWtmKAqz9RCuNtpDNHXojK+HcOVo2PKh0VsGN6ZJkx4BwysKe8lMXYkA7Hzor9mi9YWLxpRpp+qDpA4VGIiSOFA==',
  expiresAt: Date.now() + ONE_HOUR_MS,
  kibanaAccess: 'rw',
  kibanaHiddenApps: ['Enterprise Search|Overview', 'Observability'],
  kibanaIndex: '.kibana_template_group',
  lastSessionActivityDate: Date.now() + ONE_DAY_MS,
  username: 'admin'
};
