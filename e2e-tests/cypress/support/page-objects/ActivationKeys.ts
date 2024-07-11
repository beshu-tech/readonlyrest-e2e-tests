import { RorMenu } from './RorMenu';
import { SecuritySettings } from './SecuritySettings';

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
    SecuritySettings.getIframeBody().contains('Load Activation Key').click();
    SecuritySettings.getIframeBody()
      .find('[name="activationToken"]')
      .invoke('attr', 'value', ActivationKeys.DEFAULT_ACTIVATION_KEY)
      .trigger('input');
    SecuritySettings.getIframeBody().contains('Activate').click({ force: true });
  }

  static deleteLicense() {
    cy.log('Delete license');
    SecuritySettings.getIframeBody().contains('Delete').click();
    SecuritySettings.getIframeBody().contains('Delete activation key').click({ force: true });
  }
}
