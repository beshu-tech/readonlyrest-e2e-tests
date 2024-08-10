import { Login } from '../support/page-objects/Login';

describe('Report Generation', () => {
  before(() => {
    // 1. Logowanie jako "kibana:kibana"
    // Login.signOut()
    Cypress.env("login", "kibana");
    Cypress.env("password", "kibana");
    Login.signIn();

    // 2. Check if "invoices" index exists and create if it doesn't
    cy.request({
      method: 'GET',
      url: 'http://localhost:19200/_cat/indices/invoices?v',
      failOnStatusCode: false,
    }).then((response) => {
      if (response.status === 404) {
        cy.request({
          method: 'PUT',
          url: 'http://localhost:19200/invoices',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 1,
            },
          },
        });
      }
    });

    // 3. Generate example data for invoices
    const bulkBody = [
      { index: { _index: 'invoices' } },
      { id: 1, number: 'INV001', date: '2024-08-01', amount: 123.45, currency: 'USD' },
      { index: { _index: 'invoices' } },
      { id: 2, number: 'INV002', date: '2024-08-02', amount: 67.89, currency: 'EUR' }
    ];

    // Convert to newline-delimited string
    const bulkBodyString = bulkBody.map(line => JSON.stringify(line)).join('\n') + '\n';

    cy.request({
      method: 'POST',
      url: 'http://localhost:19200/invoices/_bulk',
      headers: {
        'Content-Type': 'application/json'
      },
      body: bulkBodyString
    }).then(response => {
      expect(response.status).to.eq(200); // Adjust this according to your expectations
    });

  });

  it('should generate example invoice data and create reports', () => {
    // Log in as "user2:dev"
    // Login.signOut();
    Cypress.env("login", "user2");
    Cypress.env("password", "dev");
    Login.signIn();

    // Create invoices data view
    cy.visit('http://localhost:5601/s/default/app/management/kibana/dataViews');
    cy.get('button[data-test-subj="createDataViewButton"]').click();
    cy.get('input[data-test-subj="createIndexPatternNameInput"]').type('invoices');
    cy.get('button[data-test-subj="createIndexPatternCreateButton"]').click();

    // Go to Discover and generate 10 CSV reports
    cy.visit('http://localhost:5601/app/discover');
    cy.get('select[data-test-subj="indexPattern"]').select('invoices');
    for (let i = 0; i < 10; i++) {
      cy.get('button[data-test-subj="docTableDownloadButton"]').click();
      cy.get('button[data-test-subj="generateCsvButton"]').click();
    }

    // Go to Reports and check the status of all reports
    cy.visit('http://localhost:5601/s/default/app/management/insightsAndAlerting/reporting');
    cy.get('div[data-test-subj="reportingTable"]').within(() => {
      cy.get('span[data-test-subj="reportingTableStatusColumn"]').should('have.text', 'Done');
    });

    // Log out and log in as "user3:dev"
    cy.get('button[data-test-subj="userMenuButton"]').click();
    cy.get('button[data-test-subj="logoutButton"]').click();
    Cypress.env("login", "user3");
    Cypress.env("password", "dev");
    Login.signIn();

    // Verify user3 cannot see user2's reports
    cy.visit('http://localhost:5601/s/default/app/management/insightsAndAlerting/reporting');
    cy.get('div[data-test-subj="reportingTable"]').within(() => {
      cy.get('span[data-test-subj="reportingTableStatusColumn"]').should('not.exist');
    });
  });

  after(() => {
    // Ensure proper sign out
    Cypress.env("login", "kibana");
    Cypress.env("password", "kibana");
    Login.signIn();

    // Make the request to delete the invoices index
    cy.request({
      method: 'DELETE',
      url: 'http://localhost:19200/invoices',
      headers: {
        'Content-Type': 'application/json',
      },
      failOnStatusCode: false,
    }).then(response => {
      if (response.status === 403) {
        cy.log('Access Forbidden: Check ReadonlyREST permissions');
      }
    });
  });
});
