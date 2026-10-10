import { Login } from '../support/page-objects/Login';
import { Settings } from '../support/page-objects/Settings';
import { Editor } from '../support/page-objects/Editor';
import { rorApiClient } from '../support/helpers/RorApiClient';
import { kibana } from '../support/helpers/credentials';

describe('settings', () => {
  it('should check settings', () => {
    Login.initialization();
    Settings.open();
    Settings.reloadFromFileSettings();

    cy.log('should check reload from file settings functionality');
    Settings.pressReloadFromFileSettingsButton();
    Settings.unsavedChangesModalVisible();
    Settings.reloadChangesAnywayToast();

    cy.log('should check discard changes functionality');
    Settings.discardChanges();

    cy.log('should check save changes functionality when success');
    const changedBlockName = `PERSONAL_GRP${Cypress._.random(0, 1e6)}`;
    Editor.replaceValues('PERSONAL_GRP', changedBlockName);
    Settings.clickSaveButton();
    rorApiClient.getRorIndexMainSettings().should('contain', `name: ${changedBlockName}`);
  });

  it('should save settings and verify success response from request when user without group logging in', () => {
    Login.initialization({ credentials: kibana });
    Settings.open();
    Settings.clickSaveButton();
  });
});
