import { Login } from '../support/page-objects/Login';
import { TestSettings } from '../support/page-objects/TestSettings';
import { Settings } from '../support/page-objects/Settings';

describe('Test ACL', () => {
  beforeEach(() => {
    Login.initialization();
    Settings.open();
    Settings.reloadFromFileSettings();
    Settings.clickSaveButton();
    Settings.confirmSaveModal();
    TestSettings.setDefaultData();
  });

  it('should Test ACL', () => {
    cy.log('should check invalidate settings functionality');
    TestSettings.pressInvalidateFileTestSettings();

    cy.log('should check promote as permanent settings functionality when success');
    TestSettings.pressSaveTestSettingsButton();

    /**
     * TODO: Uncomment all toast based assertions and try to make this check non-deterministic
     */

    cy.log('should check load current settings functionality');
    // Settings.successfulLoadFromFileToast().should('be.visible');
    Settings.closeToastMessages();
    // Settings.successfulLoadFromFileToast().should('not.be.visible');
    TestSettings.loadCurrentSettings();
    TestSettings.pressLoadCurrentSettingsButton();
    Settings.unsavedChangesModalVisible();
    TestSettings.loadChangesAnywayToast();
    // Settings.successfulLoadFromFileToast().should('be.visible');
  });
});
