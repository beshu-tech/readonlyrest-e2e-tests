import type { AwaitKibanaAnswersOptions, AwaitKibanaAnswersResult } from '../../plugins/awaitKibanaAnswers';
import { requiredBaseUrl, userCredentials } from './index';

// After a ROR settings change, Kibana must answer again before the next step. A short gap of 503s
// is normal. A replica that stops answering for good is a ROR KBN defect: then this fails with the
// outcomes it saw, instead of the next test failing on a login that never ends.
//
// A request through ROR KBN, not /api/status: Kibana core can answer while ROR KBN hangs. The
// request timeout is above the proxy's read timeout, so a hung replica shows as a 504.
const KIBANA_ANSWERS: Omit<AwaitKibanaAnswersOptions, 'url' | 'credentials'> = {
  inARow: 4,
  requestTimeoutMs: 20000,
  budgetMs: 90000
};

export class RorApiClient {
  // The callbacks return nothing: Cypress still runs the commands they queue before the next one.
  public configureRorIndexMainSettings(fixtureYamlFileName: string): Cypress.Chainable<void> {
    return cy.fixture(fixtureYamlFileName).then(yamlContent => {
      this.postSettingsChange('_readonlyrest/admin/config', {
        settings: `${yamlContent}`
      });
    });
  }

  public configureRorIndexTestSettings(fixtureYamlFileName: string, ttlInSeconds: number): Cypress.Chainable<void> {
    return cy.fixture(fixtureYamlFileName).then(yamlContent => {
      this.postSettingsChange('_readonlyrest/admin/config/test', {
        settings: `${yamlContent}`,
        ttl: `${ttlInSeconds} sec`
      });
    });
  }

  public configureRorAuthMockSettings(fixtureJsonFileName: string): Cypress.Chainable<void> {
    return cy.fixture(fixtureJsonFileName).then(content => {
      this.postSettingsChange('_readonlyrest/admin/config/test/authmock', content);
    });
  }

  private postSettingsChange(endpoint: string, payload: Cypress.Payload) {
    cy.esPost({
      endpoint,
      credentials: Cypress.env().kibanaUserCredentials,
      payload
    });
    this.awaitKibanaAnswers(endpoint);
  }

  private awaitKibanaAnswers(changedBy: string) {
    const { inARow, requestTimeoutMs, budgetMs } = KIBANA_ANSWERS;
    return cy
      .task<AwaitKibanaAnswersResult>(
        'awaitKibanaAnswers',
        { ...KIBANA_ANSWERS, url: `${requiredBaseUrl()}/api/spaces/space`, credentials: userCredentials },
        // The last request can start just before the budget ends.
        { timeout: budgetMs + requestTimeoutMs + 10000 }
      )
      .then(result => {
        if (!result.ok) {
          throw new Error(
            `Kibana did not answer ${inARow} requests in a row within ${budgetMs / 1000}s after ` +
              `POST ${changedBy}. Latest outcomes, oldest first: ${result.outcomes.join(', ')}`
          );
        }
        cy.log(`Kibana answers again ${result.elapsedMs}ms after POST ${changedBy}`);
      });
  }
}

export const rorApiClient = new RorApiClient();
