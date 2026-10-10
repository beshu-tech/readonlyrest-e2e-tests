import { pasteText } from '../helpers';
import { SecuritySettings } from './SecuritySettings';

export class Editor {
  static pasteConfig(config: string) {
    cy.log('paste config');
    const selectAllKeys = Cypress.platform === 'darwin' ? '{cmd}a' : '{ctrl}a';
    SecuritySettings.getIframeBody()
      .findByRole('code')
      .find('textarea')
      .eq(0)
      .focus()
      .type(`${selectAllKeys}{backspace}`, { force: true })
      .then($el => pasteText($el[0], config));
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

    // The find field can hold an earlier search or the word at the cursor.
    SecuritySettings.getIframeBody()
      .findByRole('textbox', { name: /^Find$/ })
      .clear({ force: true })
      .type(findValue, { force: true });

    SecuritySettings.getIframeBody()
      .findByRole('button', { name: /toggle replace/i })
      .click({ force: true });

    SecuritySettings.getIframeBody()
      .findByRole('textbox', { name: /Replace/ })
      .click({ force: true })
      .type(newValue, { force: true })
      .type('{enter}', { force: true });

    // The editor scrolls to the replaced text, so its rendered lines hold it.
    SecuritySettings.getIframeBody().find('.view-lines').should('contain.text', newValue);
  }
}
