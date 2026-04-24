export class SecuritySettings {
  private static getIframeDocument = () => {
    return (
      cy
        .get('#readonlyrestIframe')
        // Cypress yields jQuery element, which has the real
        // DOM element under property "0".
        // From the real DOM iframe element we can get
        // the "document" element, it is stored in "contentDocument" property
        // Cypress "its" command can access deep properties using dot notation
        // https://on.cypress.io/its
        .its('0.contentDocument')
        .should('exist')
    );
  };

  static getIframeBody = () => {
    // get the document
    return (
      SecuritySettings.getIframeDocument()
        // automatically retries until body is loaded
        .its('body')
        .should('not.be.undefined')
        // wraps "body" DOM element to allow
        // chaining more Cypress commands, like ".find(...)"
        .then(cy.wrap)
    );
  };

  static getIframeWindow = () => {
    return cy.get('#readonlyrestIframe').its('0.contentWindow').should('exist');
  };

  static waitForIframeContent(selector = '.euiTabs', timeout = 15000) {
    cy.get('#readonlyrestIframe').should('be.visible');

    return cy.window().then({ timeout }, win => {
      return new Cypress.Promise(resolve => {
        const checkIframe = () => {
          const iframe: HTMLIFrameElement = win.document.querySelector('#readonlyrestIframe');
          if (iframe && iframe.contentDocument && iframe.contentDocument.querySelector(selector)) {
            resolve();
          } else {
            setTimeout(checkIframe, 100);
          }
        };
        checkIframe();
      });
    });
  }

  static checkActiveTab(tab: string) {
    SecuritySettings.getIframeBody().findByRole('tab', { name: tab, selected: true }).should('be.visible');
  }
}
