import { Login } from '../support/page-objects/Login';
import { TestSettings } from '../support/page-objects/TestSettings';
import { Settings } from '../support/page-objects/Settings';
import { Editor } from '../support/page-objects/Editor';

describe.skip('Test ACL', () => {
  beforeEach(() => {
    Login.initialization();
    Settings.open();
    Settings.reloadFromFileSettings();
    Settings.saveFileSettings();
    TestSettings.setDefaultData();
  });

  it('should Test ACL', () => {
    cy.log('should check invalidate settings functionality');
    TestSettings.pressInvalidateFileTestSettings();

    cy.log('should check promote as permanent settings functionality when success');
    // Editor.replaceValues('PERSONAL_GRP', `PERSONAL_GRP1`);
    TestSettings.pressSaveTestSettingsButton();

    // TODO: Uncomment it when es plugin fix issue with settings

    // TestSettings.promoteAsPermanent();

    // cy.log(
    //   'should save Test ACL promote as permanent settings functionality when not saving changes'
    // );
    // Editor.replaceValues('PERSONAL_GRP', `PERSONAL_GRP2`);
    // TestSettings.pressPromoteAsPermanentButton();
    // TestSettings.saveTestSettingsBeforePermanentPromote();

    // cy.log(
    //   'should reject save Test ACL promote as permanent settings functionality when not saving changes'
    // );
    //
    // Editor.replaceValues('PERSONAL_GRP', `PERSONAL_GRP3`);
    // TestSettings.pressPromoteAsPermanentButton();
    // TestSettings.rejectSaveTestSettingsBeforePermanentPromote();
    //
    // cy.log('should failed promote as permanent when settings already exists');
    // TestSettings.pressPromoteAsPermanentButton();
    // TestSettings.saveTestSettingsBeforePermanentPromoteFailed();
    //
    // cy.log('should check save Test ACL functionality');
    // Editor.replaceValues('PERSONAL_GRP', `PERSONAL_GRP4`);
    // TestSettings.pressSaveTestSettingsButton();
    // TestSettings.successfulSaveTestSettingsToast().should('be.visible');

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
