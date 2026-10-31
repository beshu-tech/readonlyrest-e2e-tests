import { recurse } from 'cypress-recurse';
import { SecuritySettings } from './SecuritySettings';
import { adminCredentials, kibanaCredentials } from '../helpers/credentials';
import { interceptNext } from '../helpers/interceptNext';

export class ActivationKeys {
  static DEFAULT_ACTIVATION_KEY =
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzUxMiJ9.eyJleHAiOjg4MDYxMjEyODAwLCJpc3MiOiJodHRwczovL2FwaS5iZXNodS50ZWNoIiwiaWF0IjoxNjYxMzU2MTAxLCJqdGkiOiJyb3JfbGljXzI1YjJhYWE4LTE0MDEtNGI4Zi04ZDBmLTZjMzE3ZjliYTY3MCIsImF1ZCI6InJlYWRvbmx5cmVzdF9rYm4iLCJzdWIiOiIxMTExMTExMS0xMTExLTExMTEtMTExMS0xMTExMTExMSIsImxpY2Vuc29yIjp7Im5hbWUiOiJCZXNodSBMaW1pdGVkIHQvYSBSZWFkb25seVJFU1QgU2VjdXJpdHkiLCJjb250YWN0IjpbInN1cHBvcnRAcmVhZG9ubHlyZXN0LmNvbSIsImZpbmFuY2VAcmVhZG9ubHlyZXN0LmNvbSJdLCJpc3N1ZXIiOiJzdXBwb3J0QHJlYWRvbmx5cmVzdC5jb20ifSwibGljZW5zZWUiOnsibmFtZSI6IkFub255bW91cyBGcmVlIFVzZXIiLCJidXlpbmdfZm9yIjpudWxsLCJiaWxsaW5nX2VtYWlsIjoidW5rbm93bkByb3JmcmVlLmNvbSIsImFsdF9lbWFpbHMiOltdLCJhZGRyZXNzIjpbIlVua25vd24iXX0sImxpY2Vuc2UiOnsiY2x1c3Rlcl91dWlkIjoiKiIsImVkaXRpb24iOiJrYm5fZnJlZSIsImVkaXRpb25fbmFtZSI6IkZyZWUiLCJpc1RyaWFsIjpmYWxzZX19.AUpJKXec7Ed7z6v9SsK3ingQIN8WGZDEMXC5cDn2cLeWsPopwtcfXncptYUXfFUV6diJG-pFpVC41xKHBrZetVIlAcH5OJCEWIlxzMho-WrwDn8rjpTcVDE8tW_JCoE0uteTOLXy97V8vDdyW5pmJQjb7pUd2zvECxGjwFxVsrdsBDkg';

  static open() {
    SecuritySettings.openTab('activation_keys');
  }

  static changeLicenseToFree() {
    cy.log('Change license to free');
    const activateKey = interceptNext('activateKey', { method: 'POST', pathname: '/pkp/api/license' });
    SecuritySettings.getIframeBody().contains('Load Activation Key').click();
    SecuritySettings.getIframeBody()
      .find('[name="activationToken"]')
      .invoke('attr', 'value', ActivationKeys.DEFAULT_ACTIVATION_KEY)
      .trigger('input');
    // Activate is the confirm button of the modal. It stays disabled until the key field has a value.
    SecuritySettings.getIframeBody().find('[data-testid="confirm-button"]').should('not.be.disabled').click();
    cy.waitForResponse(activateKey).its('statusCode').should('equal', 200);
  }

  static deleteLicense() {
    cy.log('Delete license');
    const deleteKey = interceptNext('deleteKey', { method: 'DELETE', pathname: '/pkp/api/license' });
    SecuritySettings.getIframeBody().contains('Delete').click();
    SecuritySettings.getIframeBody().find('[data-testid="confirm-button"]').should('not.be.disabled').click();
    cy.waitForResponse(deleteKey).its('statusCode').should('equal', 200);
  }

  static verifyEdition(edition: 'kbn_free' | 'kbn_ent') {
    cy.kbnGet<{ license: { edition: string } }>({ endpoint: 'pkp/api/license', credentials: adminCredentials })
      .its('license.edition')
      .should('equal', edition);
  }

  /**
   * Runs an action that changes the edition, then waits until ROR KBN deleted the sessions.
   *
   * ROR KBN answers the change before it deletes the sessions (RORDEV-2302). Until then the old
   * session still works, and a login made in between can be deleted with the others.
   * ROR KBN deletes the sessions with their index, and then can create an empty index at once. So the
   * wait ends when the index is gone or has a new UUID. With no index (no login since the last
   * deletion) there is nothing to wait for.
   */
  static changeEditionAndWaitForLogout(action: () => void) {
    ActivationKeys.sessionIndex().then(before => {
      action();
      if (before.status === 200) {
        recurse(
          () => ActivationKeys.sessionIndex(),
          after => after.status === 404 || after.uuid !== before.uuid,
          { limit: 80, delay: 500, timeout: 40000, log: 'the sessions are deleted' }
        );
      }
    });
  }

  // Waits for the logout only when the restore changes the edition, so that it cannot log out the next test.
  static restoreEnterpriseKey() {
    const restore = () =>
      cy.kbnPost({
        endpoint: 'api/ror/license?overwrite=true',
        credentials: adminCredentials,
        payload: { license: `${Cypress.env().enterpriseActivationKey}` }
      });
    cy.kbnGet<{ license: { edition: string } }>({ endpoint: 'pkp/api/license', credentials: adminCredentials }).then(
      ({ license }) => {
        if (license.edition === 'kbn_ent') {
          restore();
        } else {
          ActivationKeys.changeEditionAndWaitForLogout(restore);
        }
      }
    );
  }

  static sessionIndex(): Cypress.Chainable<{ status: number; uuid: string | undefined }> {
    const index = '.readonlyrest_kbn_sessions';
    return cy
      .esResponse<Record<string, { settings: { index: { uuid: string } } }>>({
        endpoint: index,
        credentials: kibanaCredentials
      })
      .then(({ status, body }) => ({ status, uuid: status === 200 ? body[index].settings.index.uuid : undefined }));
  }
}
