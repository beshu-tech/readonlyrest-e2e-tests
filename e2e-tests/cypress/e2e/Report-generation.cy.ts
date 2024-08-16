import { Login } from "../support/page-objects/Login";
import { DataViews } from "../support/page-objects/management/DataViews";
import { Discover } from "../support/page-objects/Discover";
import { Reports } from "../support/page-objects/management/Reports";

describe('Report Generation', () => {
  const indexName: string = 'invoices';
  const searchName: string = `${ indexName } search`;


  before(() => {
    // Attempt to bulk index sample data
    cy.put({
      url: `${ Cypress.env().elasticsearchUrl }/${ indexName }/_bulk`,
      payload: [
        {create: {}},
        {id: 1, number: "INV001", date: "2024-08-01", amount: "123.45", currency: "USD"},
        {create: {}},
        {id: 2, number: "INV002", date: "2024-08-02", amount: "67.89", currency: "EUR"},
        {create: {}},
        {id: 3, number: "INV003", date: "2024-08-03", amount: "456.78", currency: "GBP"},
        {create: {}},
        {id: 4, number: "INV004", date: "2024-08-04", amount: "90.12", currency: "JPY"},
        {create: {}},
        {id: 5, number: "INV005", date: "2024-08-05", amount: "345.67", currency: "CAD"},
        {create: {}},
        {id: 6, number: "INV006", date: "2024-08-06", amount: "89.01", currency: "AUD"},
        {create: {}},
        {id: 7, number: "INV007", date: "2024-08-07", amount: "234.56", currency: "CHF"},
        {create: {}},
        {id: 8, number: "INV008", date: "2024-08-08", amount: "78.90", currency: "SEK"},
        {create: {}},
        {id: 9, number: "INV009", date: "2024-08-09", amount: "135.79", currency: "NZD"},
        {create: {}},
        {id: 10, number: "INV010", date: "2024-08-10", amount: "246.80", currency: "DKK"},
        {create: {}},
        {id: 11, number: "INV011", date: "2024-08-11", amount: "357.91", currency: "NOK"},
        {create: {}},
        {id: 12, number: "INV012", date: "2024-08-12", amount: "468.02", currency: "ZAR"},
        {create: {}},
        {id: 13, number: "INV013", date: "2024-08-13", amount: "579.13", currency: "BRL"},
        {create: {}},
        {id: 14, number: "INV014", date: "2024-08-14", amount: "680.24", currency: "INR"},
        {create: {}},
        {id: 15, number: "INV015", date: "2024-08-15", amount: "791.35", currency: "RUB"}
      ]
    });
  });

  beforeEach(() => {
    Login.setLogin('user2:dev');
    Login.initialization();

    DataViews.deleteSavedObjectsIfExist([indexName, searchName]);
    Reports.deleteAllReports(searchName)


    Login.signOut();
  })

  it('should generate and verify reports for user2, and user3 should not see them', () => {
    Login.setLogin('user2:dev');
    Login.initialization();

    DataViews.createDataView(indexName);

    Discover.navigateTo();

    Discover.selectDataView(indexName);
    Discover.saveSearch(searchName);
    for (let i = 0; i < 10; i++) {
      Discover.generateCsvReport(50000);
    }

    // Go to Reports and check if all reports are not empty
    Reports.navigateTo();
    Reports.checkAllReports(searchName);

    Login.signOut();

    Login.setLogin('user3:dev');
    Login.initialization();

    Reports.navigateTo();
    Reports.verifyNoReports();

    Login.signOut();
  });

  afterEach(() => {
    Login.setLogin('user2:dev');
    Login.initialization();

    DataViews.deleteSavedObjectsIfExist([indexName, searchName]);
    Reports.deleteAllReports(searchName)


    Login.signOut();
  })

  after(() => {
    cy.delete({
      url: `${ Cypress.env().elasticsearchUrl }/${ indexName }/_bulk`,
    })
  });
});
