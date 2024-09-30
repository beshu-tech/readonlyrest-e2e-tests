import { Login } from '../support/page-objects/Login';
import { Impersonate } from '../support/page-objects/Impersonate';
import { SecuritySettings } from '../support/page-objects/SecuritySettings';
import { TestSettings } from '../support/page-objects/TestSettings';
import { rorApiClient } from '../support/helpers/RorApiClient';

describe('impersonate', () => {
  beforeEach(() => {
    // rorApiClient.configureRorIndexMainSettings("defaultSettings.yaml")
    Login.initialization();
  });

  it('test', () => {
    cy.log('should check service lists rendering');
    rorApiClient.configureRorIndexMainSettings("defaultSettings.yaml")
    // Impersonate.setTestSettingsData();
  });

  // it('should check impersonate', () => {
  //   // TODO: We need  to find a way to remove Test ACL completely before tests

  //   // cy.log('back from initialize Test ACL into a test ACL tab');
  //   // Impersonate.open();
  //   // Impersonate.backFromInitializeTestSettings();
  //   // SecuritySettings.checkActiveTab('Test ACL');
  //   //
  //   // cy.log('initialize Test ACL');
  //   // Impersonate.open();
  //   // Impersonate.initializeTestSettings();
  //   // KibanaNavigation.openHomepage();

  //   cy.log('should check service lists rendering');

  //   Impersonate.setTestSettingsData();

  //   TestSettings.open();
  //   Impersonate.open();

  //   const createLdapUsers = () => {
  //     Impersonate.openConfigureServiceDialog(0);
  //     Impersonate.addEditMockUser('JohnDoe', ['group3']);
  //     Impersonate.addEditMockUser('RobertSmith', ['group3']);
  //     Impersonate.saveEditMockUsers();
  //   };

  //   const createAuthnUsers = () => {
  //     Impersonate.openConfigureServiceDialog(1);
  //     Impersonate.addEditMockUser('JaneDoe');
  //     Impersonate.saveEditMockUsers();
  //   };

  //   const createAuthzUsers = () => {
  //     Impersonate.openConfigureServiceDialog(2);
  //     Impersonate.addEditMockUser('JaimeRhynes', ['Customer']);
  //     Impersonate.saveEditMockUsers();
  //   };

  //   const assertLdapService = () => {
  //     cy.log('should assert ldap service');
  //     Impersonate.assertServiceName(0, 'LDAP 1');
  //     Impersonate.assertServiceType(0, 'ldap');
  //     Impersonate.assertServiceColumns(0, ['Username', 'Groups']);
  //     Impersonate.assertUser(0, 0, 'JohnDoe', ['group3']);
  //     Impersonate.assertUser(0, 1, 'RobertSmith', ['group3']);
  //   };

  //   const assertAuthnService = () => {
  //     cy.log('should assert authn service');
  //     Impersonate.assertServiceName(1, 'ACME1 External Authorization Service');
  //     Impersonate.assertServiceType(1, 'authn');
  //     Impersonate.assertServiceColumns(1, ['Username']);
  //     Impersonate.assertUser(1, 0, 'JaneDoe');
  //   };

  //   const assertAuthzService = () => {
  //     cy.log('should assert authz service');
  //     Impersonate.assertServiceName(2, 'ACME2 External Authentication Service');
  //     Impersonate.assertServiceType(2, 'authz');
  //     Impersonate.assertServiceColumns(2, ['Username', 'Groups']);
  //     Impersonate.assertUser(2, 0, 'JaimeRhynes', ['Customer']);
  //   };

  //   const assertLocalUser = () => {
  //     cy.log('should assert local user');
  //     Impersonate.assertServiceName(3, 'Local users');
  //     Impersonate.assertServiceType(3, 'local');
  //     Impersonate.assertServiceColumns(3, ['Username']);
  //     Impersonate.assertUser(3, 0, 'kibana');
  //   };

  //   createLdapUsers();
  //   assertLdapService();

  //   createAuthnUsers();
  //   assertAuthnService();

  //   createAuthzUsers();
  //   assertAuthzService();

  //   assertLocalUser();

  //   cy.log('should edit existing auth mock');
  //   Impersonate.openEditAuthMockDialog(2);
  //   Impersonate.addEditMockUser('kibana', ['group3']);
  //   Impersonate.saveEditMockUsers();
  //   Impersonate.assertUser(2, 1, 'kibana', ['group3']);

  //   cy.log('should free impersonate user check');
  //   Impersonate.freeTypeImpersonateUser('new_user');
  //   Impersonate.finishImpersonation();

  //   cy.log('should impersonate localUser');
  //   Impersonate.impersonateUserFromTheList(3, 2, 'new_user');
  //   Impersonate.finishImpersonation();

  //   cy.log('should impersonate LDAP user');
  //   Impersonate.impersonateUserFromTheList(0, 1, 'RobertSmith');
  //   Impersonate.finishImpersonation();

  //   cy.log('should back from expired Test ACL dialog into a Test ACL tab');
  //   TestSettings.clickTestSettingsTab();
  //   TestSettings.pressInvalidateFileTestSettings();
  //   Impersonate.clickImpersonateTab();
  //   Impersonate.checkIfExpiredModal();
  //   Impersonate.backFromExpiredTestSettings();
  //   SecuritySettings.checkActiveTab('Test ACL');

  //   // cy.log('should reactivate old Test ACL');
  //   // Impersonate.clickImpersonateTab();
  //   // Impersonate.checkIfExpiredModal();
  //   // Impersonate.initializeTestSettings();

  //   // cy.log('should start over from current settings');
  //   // TestSettings.clickTestSettingsTab();
  //   // TestSettings.pressInvalidateFileTestSettings()
  //   // Impersonate.clickImpersonateTab()
  //   // Impersonate.checkIfExpiredModal();
  //   // Impersonate.startOverFromCurrentSettings();
  // });
});
