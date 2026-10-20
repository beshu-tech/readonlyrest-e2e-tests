import { Login } from '../support/page-objects/Login';
import { Impersonate } from '../support/page-objects/Impersonate';
import { SecuritySettings } from '../support/page-objects/SecuritySettings';
import { TestSettings } from '../support/page-objects/TestSettings';
import { rorApiInternalKbnClient } from '../support/helpers/RorApiInternalKbnClient';
import { adminCredentials } from '../support/helpers/credentials';

describe('impersonate', () => {
  afterEach(() => {
    rorApiInternalKbnClient.deactivateTestSettings();
  });

  describe('impersonation tab', () => {
    beforeEach(() => {
      Login.initialization();
      Impersonate.setTestSettingsData();
      TestSettings.open();
      Impersonate.open();
    });

    const createLdapUsers = () => {
      Impersonate.openConfigureServiceDialog(0);
      Impersonate.addEditMockUser('JohnDoe', ['group3']);
      Impersonate.addEditMockUser('RobertSmith', ['group3']);
      Impersonate.saveEditMockUsers();
    };

    it('should list the users of each mock service', () => {
      createLdapUsers();
      Impersonate.assertServiceName(0, 'LDAP 1');
      Impersonate.assertServiceType(0, 'ldap');
      Impersonate.assertServiceColumns(0, ['Username', 'Groups']);
      Impersonate.assertUser(0, 'JohnDoe', ['group3']);
      Impersonate.assertUser(0, 'RobertSmith', ['group3']);

      Impersonate.openConfigureServiceDialog(1);
      Impersonate.addEditMockUser('JaneDoe');
      Impersonate.saveEditMockUsers();
      Impersonate.assertServiceName(1, 'ACME1 External Authorization Service');
      Impersonate.assertServiceType(1, 'authn');
      Impersonate.assertServiceColumns(1, ['Username']);
      Impersonate.assertUser(1, 'JaneDoe');

      Impersonate.openConfigureServiceDialog(2);
      Impersonate.addEditMockUser('JaimeRhynes', ['Customer']);
      Impersonate.saveEditMockUsers();
      Impersonate.assertServiceName(2, 'ACME2 External Authentication Service');
      Impersonate.assertServiceType(2, 'authz');
      Impersonate.assertServiceColumns(2, ['Username', 'Groups']);
      Impersonate.assertUser(2, 'JaimeRhynes', ['Customer']);

      Impersonate.assertServiceName(3, 'Local users');
      Impersonate.assertServiceType(3, 'local');
      Impersonate.assertServiceColumns(3, ['Username']);
      Impersonate.assertUser(3, 'kibana');

      cy.log('should edit existing auth mock');
      Impersonate.openEditAuthMockDialog(2);
      Impersonate.addEditMockUser('kibana', ['group3']);
      Impersonate.saveEditMockUsers();
      Impersonate.assertUser(2, 'kibana', ['group3']);
    });

    // Skipped until a release has the fix for RORDEV-2303: the session probe can log the user out right
    // after an impersonation starts, so this test fails at random.
    it.skip('should impersonate a local user and an LDAP user (RORDEV-2303)', () => {
      createLdapUsers();

      Impersonate.open();
      Impersonate.impersonateUserFromTheList(3, 3, 'new_user');
      Impersonate.finishImpersonation();
      Impersonate.verifyFinishedImpersonation();

      Impersonate.open();
      Impersonate.impersonateUserFromTheList(0, 1, 'RobertSmith');
      Impersonate.finishImpersonation();
      Impersonate.verifyFinishedImpersonation();
    });

    it('should go back from the expired Test ACL dialog to the Test ACL tab', () => {
      TestSettings.open();
      TestSettings.pressInvalidateFileTestSettings();
      Impersonate.clickImpersonateTab();
      Impersonate.checkIfExpiredModal();
      Impersonate.backFromExpiredTestSettings();
      SecuritySettings.checkActiveTab('Test ACL');
    });
  });

  it('should check direct kibana request with x-ror-impersonating header', () => {
    const impersonatingUser1 = 'user1';

    cy.log('should return 403 error when test settings are not configured');
    rorApiInternalKbnClient
      .getLicense({ impersonating: impersonatingUser1, credentials: adminCredentials })
      .then(response => {
        expect(response.status).to.eq(403);
        expect(response.body.status).to.eq('TEST_SETTINGS_NOT_CONFIGURED');
      });

    cy.log(
      'should return not sufficient access level error when impersonated user is not an admin or unrestricted access level'
    );
    Impersonate.setTestSettingsData();
    rorApiInternalKbnClient
      .getLicense({ impersonating: impersonatingUser1, credentials: adminCredentials })
      .then(response => {
        expect(response.status).to.eq(403);
        expect(response.body.message).to.eq("You don't have sufficient permissions to perform this operation.");
        expect(response.body.status).to.eq('FORBIDDEN');
      });

    cy.log('should return data when the user has access to the license');
    rorApiInternalKbnClient.getLicense({ credentials: adminCredentials }).then(response => {
      expect(response.status).to.eq(200);
      expect(['https://api.beshu.tech', 'https://portal.readonlyrest.com']).to.include(response.body.iss);
    });
  });
});
