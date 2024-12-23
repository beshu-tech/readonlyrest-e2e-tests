export class Observability {
  static addSampleApmEvents() {
    cy.log('Add sample Apm Events');
    cy.request('http://localhost:3000');
    cy.request({ url: 'http://localhost:3000/error', method: 'GET', failOnStatusCode: false });
  }

  static openApmInstance(name: string) {
    cy.log('Open APM instance');
    cy.findByText(name).click();
  }

  static changeApmTransactionType(type: 'request' | 'custom') {
    console.log('change APM transaction type');
    cy.get('[data-test-subj="headerFilterTransactionType"]').select(type);
  }

  static getApmCustomEvent(name: string) {
    cy.log(`Get apm custom event`);
    return cy.findByRole('link', {
      name: name
    });
  }
}
