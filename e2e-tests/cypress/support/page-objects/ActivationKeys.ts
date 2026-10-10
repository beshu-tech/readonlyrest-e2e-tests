import { RorMenu } from './RorMenu';
import { recurse } from 'cypress-recurse';
import { SecuritySettings } from './SecuritySettings';
import { userCredentials } from '../helpers';

export class ActivationKeys {
  static DEFAULT_ACTIVATION_KEY =
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzUxMiJ9.eyJleHAiOjg4MDYxMjEyODAwLCJpc3MiOiJodHRwczovL2FwaS5iZXNodS50ZWNoIiwiaWF0IjoxNjYxMzU2MTAxLCJqdGkiOiJyb3JfbGljXzI1YjJhYWE4LTE0MDEtNGI4Zi04ZDBmLTZjMzE3ZjliYTY3MCIsImF1ZCI6InJlYWRvbmx5cmVzdF9rYm4iLCJzdWIiOiIxMTExMTExMS0xMTExLTExMTEtMTExMS0xMTExMTExMSIsImxpY2Vuc29yIjp7Im5hbWUiOiJCZXNodSBMaW1pdGVkIHQvYSBSZWFkb25seVJFU1QgU2VjdXJpdHkiLCJjb250YWN0IjpbInN1cHBvcnRAcmVhZG9ubHlyZXN0LmNvbSIsImZpbmFuY2VAcmVhZG9ubHlyZXN0LmNvbSJdLCJpc3N1ZXIiOiJzdXBwb3J0QHJlYWRvbmx5cmVzdC5jb20ifSwibGljZW5zZWUiOnsibmFtZSI6IkFub255bW91cyBGcmVlIFVzZXIiLCJidXlpbmdfZm9yIjpudWxsLCJiaWxsaW5nX2VtYWlsIjoidW5rbm93bkByb3JmcmVlLmNvbSIsImFsdF9lbWFpbHMiOltdLCJhZGRyZXNzIjpbIlVua25vd24iXX0sImxpY2Vuc2UiOnsiY2x1c3Rlcl91dWlkIjoiKiIsImVkaXRpb24iOiJrYm5fZnJlZSIsImVkaXRpb25fbmFtZSI6IkZyZWUiLCJpc1RyaWFsIjpmYWxzZX19.AUpJKXec7Ed7z6v9SsK3ingQIN8WGZDEMXC5cDn2cLeWsPopwtcfXncptYUXfFUV6diJG-pFpVC41xKHBrZetVIlAcH5OJCEWIlxzMho-WrwDn8rjpTcVDE8tW_JCoE0uteTOLXy97V8vDdyW5pmJQjb7pUd2zvECxGjwFxVsrdsBDkg';

  static open() {
    cy.log('Open Activation key');
    RorMenu.openRorMenu();
    RorMenu.openEditSecuritySettings();
    ActivationKeys.clickActivationKeysTab();
  }

  static clickActivationKeysTab() {
    cy.log('Click Activation key tab');
    SecuritySettings.getIframeBody().find('[class=euiTabs]').find('#activation_keys').click();
  }

  static changeLicenseToFree() {
    cy.log('Change license to free');
    cy.intercept({ method: 'POST', pathname: '/pkp/api/license' }).as('activateKey');
    SecuritySettings.getIframeBody().contains('Load Activation Key').click();
    SecuritySettings.getIframeBody()
      .find('[name="activationToken"]')
      .invoke('attr', 'value', ActivationKeys.DEFAULT_ACTIVATION_KEY)
      .trigger('input');
    // Activate is the confirm button of the modal. It stays disabled until the key field has a value.
    SecuritySettings.getIframeBody().find('[data-testid="confirm-button"]').should('not.be.disabled').click();
    cy.waitForResponse('@activateKey').its('statusCode').should('equal', 200);
  }

  static deleteLicense() {
    cy.log('Delete license');
    cy.intercept({ method: 'DELETE', pathname: '/pkp/api/license' }).as('deleteKey');
    SecuritySettings.getIframeBody().contains('Delete').click();
    SecuritySettings.getIframeBody().find('[data-testid="confirm-button"]').should('not.be.disabled').click();
    cy.waitForResponse('@deleteKey').its('statusCode').should('equal', 200);
  }

  static verifyEdition(edition: 'kbn_free' | 'kbn_ent') {
    cy.kbnGet<{ license: { edition: string } }>({ endpoint: 'pkp/api/license', credentials: userCredentials })
      .its('license.edition')
      .should('equal', edition);
  }

  /**
   * Runs an action that changes the edition, then waits until ROR KBN deleted the sessions.
   *
   * ROR KBN answers the change before it deletes the sessions (RORDEV-2302). Until then the old
   * session still works, and a login made in between can be deleted with the others.
   * The sessions are deleted with their index, so the wait is for that index to go. With no index
   * (no login since the last deletion) there is nothing to wait for.
   */
  static changeEditionAndWaitForLogout(action: () => void) {
    ActivationKeys.sessionIndexStatus().then(statusBefore => {
      action();
      if (statusBefore === 200) {
        recurse(
          () => ActivationKeys.sessionIndexStatus(),
          status => status === 404,
          { limit: 60, delay: 500, timeout: 40000, log: 'the sessions are deleted' }
        );
      }
    });
  }

  static sessionIndexStatus() {
    return cy.esResponse({ endpoint: '.readonlyrest_kbn_sessions' }).its('status');
  }
}
