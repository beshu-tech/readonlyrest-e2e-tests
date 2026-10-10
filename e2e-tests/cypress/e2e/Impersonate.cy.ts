import { Login } from '../support/page-objects/Login';
import { Impersonate } from '../support/page-objects/Impersonate';
import { SecuritySettings } from '../support/page-objects/SecuritySettings';
import { TestSettings } from '../support/page-objects/TestSettings';
import { rorApiInternalKbnClient } from '../support/helpers/RorApiInternalKbnClient';

describe('impersonate', () => {
  afterEach(() => {
    rorApiInternalKbnClient.deactivateTestSettings();
  });

  // Skipped until a release has the fix for RORDEV-2303: the session probe can log the user out right
  // after an impersonation starts, so this test fails at random.
  it.skip('should check impersonate (RORDEV-2303)', () => {
    Login.initialization();

    cy.log('should check service lists rendering');

    Impersonate.setTestSettingsData();

    TestSettings.open();
    Impersonate.open();

    const createLdapUsers = () => {
      Impersonate.openConfigureServiceDialog(0);
      Impersonate.addEditMockUser('JohnDoe', ['group3']);
      Impersonate.addEditMockUser('RobertSmith', ['group3']);
      Impersonate.saveEditMockUsers();
    };

    const createAuthnUsers = () => {
      Impersonate.openConfigureServiceDialog(1);
      Impersonate.addEditMockUser('JaneDoe');
      Impersonate.saveEditMockUsers();
    };

    const createAuthzUsers = () => {
      Impersonate.openConfigureServiceDialog(2);
      Impersonate.addEditMockUser('JaimeRhynes', ['Customer']);
      Impersonate.saveEditMockUsers();
    };

    const assertLdapService = () => {
      cy.log('should assert ldap service');
      Impersonate.assertServiceName(0, 'LDAP 1');
      Impersonate.assertServiceType(0, 'ldap');
      Impersonate.assertServiceColumns(0, ['Username', 'Groups']);
      Impersonate.assertUser(0, 0, 'JohnDoe', ['group3']);
      Impersonate.assertUser(0, 1, 'RobertSmith', ['group3']);
    };

    const assertAuthnService = () => {
      cy.log('should assert authn service');
      Impersonate.assertServiceName(1, 'ACME1 External Authorization Service');
      Impersonate.assertServiceType(1, 'authn');
      Impersonate.assertServiceColumns(1, ['Username']);
      Impersonate.assertUser(1, 0, 'JaneDoe');
    };

    const assertAuthzService = () => {
      cy.log('should assert authz service');
      Impersonate.assertServiceName(2, 'ACME2 External Authentication Service');
      Impersonate.assertServiceType(2, 'authz');
      Impersonate.assertServiceColumns(2, ['Username', 'Groups']);
      Impersonate.assertUser(2, 0, 'JaimeRhynes', ['Customer']);
    };

    const assertLocalUser = () => {
      cy.log('should assert local user');
      Impersonate.assertServiceName(3, 'Local users');
      Impersonate.assertServiceType(3, 'local');
      Impersonate.assertServiceColumns(3, ['Username']);
      Impersonate.assertUser(3, 0, 'kibana');
    };

    createLdapUsers();
    assertLdapService();

    createAuthnUsers();
    assertAuthnService();

    createAuthzUsers();
    assertAuthzService();

    assertLocalUser();

    cy.log('should edit existing auth mock');
    Impersonate.openEditAuthMockDialog(2);
    Impersonate.addEditMockUser('kibana', ['group3']);
    Impersonate.saveEditMockUsers();
    Impersonate.assertUser(2, 1, 'kibana', ['group3']);

    cy.log('should impersonate localUser');
    Impersonate.open();
    Impersonate.impersonateUserFromTheList(3, 2, 'new_user');
    Impersonate.finishImpersonation();
    Impersonate.verifyFinishedImpersonation();

    cy.log('should impersonate LDAP user');
    Impersonate.open();
    Impersonate.impersonateUserFromTheList(0, 1, 'RobertSmith');
    Impersonate.finishImpersonation();
    Impersonate.verifyFinishedImpersonation();

    cy.log('should back from expired Test ACL dialog into a Test ACL tab');
    TestSettings.open();
    TestSettings.pressInvalidateFileTestSettings();
    Impersonate.clickImpersonateTab();
    Impersonate.checkIfExpiredModal();
    Impersonate.backFromExpiredTestSettings();
    SecuritySettings.checkActiveTab('Test ACL');
  });

  it('should check direct kibana request with x-ror-impersonating header', () => {
    const impersonatingUser1 = 'user1';
    const admin = 'admin:dev';

    cy.log('should return 403 error when test settings are not configured');
    rorApiInternalKbnClient.getLicense({ impersonating: impersonatingUser1, credentials: admin }).then(response => {
      expect(response.status).to.eq(403);
      expect(response.body.status).to.eq('TEST_SETTINGS_NOT_CONFIGURED');
    });

    cy.log(
      'should return not sufficient access level error when impersonated user is not an admin or unrestricted access level'
    );
    Impersonate.setTestSettingsData();
    rorApiInternalKbnClient.getLicense({ impersonating: impersonatingUser1, credentials: admin }).then(response => {
      expect(response.status).to.eq(403);
      expect(response.body.message).to.eq("You don't have sufficient permissions to perform this operation.");
      expect(response.body.status).to.eq('FORBIDDEN');
    });

    cy.log('should return data when the user has access to the license');
    rorApiInternalKbnClient.getLicense({ credentials: admin }).then(response => {
      expect(response.status).to.eq(200);
      expect(['https://api.beshu.tech', 'https://portal.readonlyrest.com']).to.include(response.body.iss);
    });
  });
});
