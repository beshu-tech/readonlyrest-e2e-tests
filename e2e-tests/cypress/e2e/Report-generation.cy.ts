// report-generation.spec.ts
import { Login } from "../support/page-objects/Login";
import { DataViews } from "../support/page-objects/management/DataViews";
import { Discover } from "../support/page-objects/Discover";
import { Reports } from "../support/page-objects/management/Reports";
import { DevTools } from "../support/page-objects/DevTools";

describe('Report Generation', () => {
  const indexPatternName: string = 'invoices';
  const searchName: string = `${ indexPatternName } search`;


  before(() => {
    // Log in as "kibana:kibana" (adjust credentials if needed)
    Login.setLogin('kibana:kibana');
    Login.initialization();

    DevTools.openDevTools();

    // Attempt to bulk index sample data
    DevTools.sendRequest(
      'PUT invoices/_bulk\n' +
      '{"create":{ }}\n' +
      '{"id": 1,"number": "INV001","date": "2024-08-01","amount": 123.45,"currency": "USD"}\n' +
      '{"create":{ }}\n' +
      '{"id": 2,"number": "INV002","date": "2024-08-02","amount": 67.89,"currency": "EUR"}'
    )
    DevTools.verifyIf200Status();

    // Check if the "invoices" index exists after the bulk operation
    DevTools.sendRequest(`GET ${ indexPatternName }`);
    DevTools.verifyIf200Status();
    Login.signOut();
  });

  beforeEach(() => {
    // Log in as "user2:dev"
    Login.setLogin('user2:dev');
    Login.initialization();

    DataViews.deleteSavedObjectsIfExist([indexPatternName, searchName]);
    Reports.deleteAllReports(searchName)


    Login.signOut();
  })

  it('should generate and verify reports for user2, and user3 should not see them', () => {
    // Log in as "user2:dev"
    Login.setLogin('user2:dev');
    Login.initialization();

    // Create invoices data view
    DataViews.createDataView(indexPatternName);

    // Go to Discover and generate 10 CSV reports
    Discover.navigateTo();

    Discover.selectDataView(indexPatternName);
    Discover.saveReport(searchName);
    // Discover.selectDataView(indexPatternName);
    for (let i = 0; i < 10; i++) {
      Discover.generateCsvReport();
    }

    // Go to Reports and wait for all reports to be 'Done'
    Reports.navigateTo();
    Reports.waitForAllReportsToBeDone(searchName);

    // Log out
    Login.signOut();

    // Log in as "user3:dev"
    Login.setLogin('user3:dev');
    Login.initialization();

    // Go to Reports and verify there are no reports
    Reports.navigateTo();
    Reports.verifyNoReports();

    Login.signOut();
  });

  afterEach(() => {
    // Log in as "user2:dev"
    Login.setLogin('user2:dev');
    Login.initialization();

    DataViews.deleteSavedObjectsIfExist([indexPatternName, searchName]);
    Reports.deleteAllReports(searchName)


    Login.signOut();
  })

  after(() => {
    // Log in as "kibana:kibana"
    Login.setLogin('kibana:kibana');
    Login.initialization();

    // Delete the "invoices" index
    DevTools.openDevTools();

    DevTools.sendRequest(`DELETE ${ indexPatternName }`);
    DevTools.verifyIf200Status();

    Login.signOut();
  });
});
