import { Login } from '../support/page-objects/Login';
import { RorMenu } from '../support/page-objects/RorMenu';
import { Settings } from '../support/page-objects/Settings';
import { Editor } from '../support/page-objects/Editor';
import { rorApiInternalKbnClient } from '../support/helpers/RorApiInternalKbnClient';

// It will be unskipped when https://github.com/beshu-tech/readonlyrest-e2e-tests/pull/116 is merged.
describe.skip('Ror config', () => {
  beforeEach(() => {
    Login.initialization();
  });

  afterEach(() => {
    // const RORSettingsIndex = '.readonlyrest';

    // FIXME: For some reason delete index freeze cypress, let's investigate later
    // esApiClient.deleteIndex(RORSettingsIndex);
    rorApiInternalKbnClient.changeKibanaConfig('defaultKibanaConfig.yml');
  });

  it('should save ReadonlyREST Kibana config to the index', () => {
    RorMenu.openRorMenu();
    RorMenu.openEditSecuritySettings();
    // // Fixme: This is workaround for the Es plugin validation when no index is present
    Settings.clickSaveButton();
    cy.fixture('settingsWithReadonlyRestKbn.yml').then(data => {
      Editor.pasteConfig(data);
    });
    cy.intercept({ pathname: '/pkp/api/settings', method: 'POST' }).as('saveSettings');
    Settings.clickSaveButton();
    cy.wait('@saveSettings');
    RorMenu.openRorMenu();
    RorMenu.pressLogoutButton();
    Login.verifyLoginPageTitle('Loaded from index!');
  });
});
