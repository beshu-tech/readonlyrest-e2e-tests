import { Login } from "../support/page-objects/Login";
import { DataViews } from "../support/page-objects/management/DataViews";
import { Discover } from "../support/page-objects/Discover";
import { Reports } from "../support/page-objects/management/Reports";
import { dataPut } from "../support/page-objects/invoices";

describe('Report Generation', () => {
  const indexName: string = 'invoices';
  const searchName: string = `${ indexName } search`;


  before(() => {
    dataPut(1000000, indexName, 600, 200);
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
      Discover.generateCsvReport();
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
    cy.esDelete({
      endpoint: indexName,
      credentials: 'kibana:kibana',
    })
  });
});