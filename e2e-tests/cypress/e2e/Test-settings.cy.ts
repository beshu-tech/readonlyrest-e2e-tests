import { Login } from '../support/page-objects/Login';
import { TestSettings } from '../support/page-objects/TestSettings';
import { Settings } from '../support/page-objects/Settings';
import { rorApiClient } from '../support/helpers/RorApiClient';

describe('Test ACL', () => {
  beforeEach(() => {
    Login.initialization();
    Settings.open();
    Settings.reloadFromFileSettings();
    Settings.clickSaveButton();
    TestSettings.setDefaultData();
  });

  it('should Test ACL', () => {
    cy.log('should check invalidate settings functionality');
    TestSettings.pressInvalidateFileTestSettings();
    rorApiClient.getRorTestSettingsStatus().should('equal', 'TEST_SETTINGS_INVALIDATED');

    cy.log('should check promote as permanent settings functionality when success');
    TestSettings.pressSaveTestSettingsButton();
    rorApiClient.getRorTestSettingsStatus().should('equal', 'TEST_SETTINGS_PRESENT');

    cy.log('should check load current settings functionality');
    Settings.closeToastMessages();
    TestSettings.loadCurrentSettings();
    TestSettings.pressLoadCurrentSettingsButton();
    Settings.unsavedChangesModalVisible();
    TestSettings.loadChangesAnywayToast();
  });
});
