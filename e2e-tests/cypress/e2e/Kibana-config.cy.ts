import { rorApiInternalKbnClient } from '../support/helpers/RorApiInternalKbnClient';
import { Login } from '../support/page-objects/Login';
import { kbnApiAdvancedClient } from '../support/helpers/KbnApiAdvancedClient';
import { RorMenu } from '../support/page-objects/RorMenu';
import { esApiClient } from '../support/helpers/EsApiClient';
import { getKibanaVersion } from '../support/helpers';

describe('Kibana-config', () => {
  before(() => {
    rorApiInternalKbnClient.changeKibanaConfig('customKibanaConfig.yml');
    kbnApiAdvancedClient.waitForKibanaHealth(Cypress.config().baseUrl);
  });

  after(() => {
    rorApiInternalKbnClient.changeKibanaConfig('defaultKibanaConfig.yml');
    kbnApiAdvancedClient.waitForKibanaHealth(Cypress.config().baseUrl);
  });

  it('should verify disabled multiTenancy', () => {
    Login.initialization();
    RorMenu.openRorMenu();
    RorMenu.verifyNoTenantAvailable();
  });

  it('should verify custom Kibana index', () => {
    const customIndex = `.kibana_custom_${getKibanaVersion()}_001`;
    esApiClient.findIndicesByPattern(customIndex).then(result => {
      const foundIndex = result.find(({ index }) => index === customIndex);
      expect(foundIndex.index).to.equal(customIndex);
      expect(foundIndex.health).to.equal('green');
      expect(Number.parseInt(foundIndex['docs.count'], 10)).to.be.greaterThan(0);
    });
  });
});
