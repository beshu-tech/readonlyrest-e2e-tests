import { SecuritySettings } from './SecuritySettings';

export class Editor {
  static changeConfig(config: string) {
    cy.log('Change text');
    const selectAllKeys = Cypress.platform === 'darwin' ? '{cmd}a' : '{ctrl}a';
    SecuritySettings.getIframeBody()
      .findByRole('code')
      .find('textarea')
      .eq(0)
      .focus()
      .type(`${selectAllKeys}{backspace}`, { force: true })
      .type(config, { force: true });
  }

  static pasteConfig(config: string) {
    cy.log('paste config');
    const selectAllKeys = Cypress.platform === 'darwin' ? '{cmd}a' : '{ctrl}a';
    SecuritySettings.getIframeBody()
      .findByRole('code')
      .find('textarea')
      .eq(0)
      .focus()
      .type(`${selectAllKeys}{backspace}`, { force: true })
      .then($el => {
        const clipboardData = new DataTransfer();
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData
        });
        clipboardData.setData('text/plain', config);
        $el[0].dispatchEvent(pasteEvent);
      });
  }

  static replaceValues(findValue: string, newValue: string) {
    cy.log('Replace values');
    const findKeys = Cypress.platform === 'darwin' ? '{cmd}f' : '{ctrl}f';
    const closeSearchBoxIfExist = '{esc}';

    SecuritySettings.getIframeBody().as('iframeBody');

    cy.get('@iframeBody')
      .findByRole('code')
      .find('textarea')
      .eq(0)
      .focus()
      .type(closeSearchBoxIfExist, { force: true })
      .type(findKeys, { force: true });

    SecuritySettings.getIframeBody()
      .findByRole('button', { name: /toggle replace/i })
      .click({ force: true });

    SecuritySettings.getIframeBody()
      .findByRole('textbox', { name: /Replace/ })
      .click({ force: true })
      .type(newValue, { force: true })
      .type('{enter}', { force: true });
  }
}
