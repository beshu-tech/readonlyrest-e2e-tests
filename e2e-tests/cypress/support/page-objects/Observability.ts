import { recurse } from 'cypress-recurse';
import { kibanaVersion } from '../helpers';
import { esApiClient } from '../helpers/EsApiClient';
import type { HttpResponse } from '../types';

export class Observability {
  // APM Server 8+ creates each data stream at its first write, and from 8.7 the 10m and 60m metrics write
  // only at their first flush. Until its primary shard is assigned, a _delete_by_query on it fails with 503
  // "missing shards". A data stream delete reads no shard. APM Server 7 creates its indices at start.
  static deleteApmData() {
    if (kibanaVersion.gte('8.0.0')) {
      esApiClient.deleteDataStream('*-apm*');
    } else {
      esApiClient.deleteIndexDocsByQuery('apm-*');
    }
  }

  static addSampleApmEvents() {
    cy.log('Add sample Apm Events');
    cy.wrap(null, { log: false }).then(() => {
      const sentAt = new Date();
      cy.request('http://localhost:3000');
      cy.request({ url: 'http://localhost:3000/error', method: 'GET', failOnStatusCode: false });
      Observability.waitForSampleApmEventsInElasticsearch(sentAt);
    });
  }

  // The APM UI shows "no data" until an APM document is searchable, and takes the transaction types
  // from the 1m metrics when the time range holds any. So it opens only when both the raw events and
  // the 1m metrics hold every event of the test.
  private static waitForSampleApmEventsInElasticsearch(sentAt: Date) {
    // The agent stamps the events with the clock of its container. On Docker Desktop, that clock can be
    // behind the clock of Cypress.
    const eventsSince = new Date(sentAt.getTime() - 10000);
    const startOfMinute = new Date(eventsSince);
    startOfMinute.setUTCSeconds(0, 0);
    const events = { range: { '@timestamp': { gte: eventsSince.toISOString() } } };
    const metrics = { range: { '@timestamp': { gte: startOfMinute.toISOString() } } };
    const filter = (since: object, field: string, value: string, type?: string) => ({
      bool: {
        filter: [since, { term: { [field]: value } }, ...(type ? [{ term: { 'transaction.type': type } }] : [])]
      }
    });
    const metricsets = kibanaVersion.gte('8.7.0') ? ['transaction', 'service_transaction'] : ['transaction'];
    const required = {
      error: filter(events, 'processor.event', 'error'),
      ...Object.fromEntries(
        (['request', 'custom'] as const).flatMap(type => [
          [`transaction ${type}`, filter(events, 'processor.event', 'transaction', type)],
          ...metricsets.map(name => [`${name} metrics ${type}`, filter(metrics, 'metricset.name', name, type)])
        ])
      )
    };

    type Buckets = Record<string, { doc_count: number }>;
    type ReadinessResponse = HttpResponse<{ aggregations?: { required: { buckets: Buckets } } }>;
    // A 503 means that every APM shard the search matches is new and not assigned yet. A body without
    // aggregations means that no APM index exists, for example right after the cleanup.
    const missingData = (response: ReadinessResponse) => {
      const buckets = response.body.aggregations?.required.buckets;
      return buckets
        ? Object.entries(buckets)
            .filter(([, bucket]) => bucket.doc_count === 0)
            .map(([name]) => name)
        : [`all of it (HTTP ${response.status})`];
    };

    return recurse(
      () =>
        esApiClient.searchResponse<ReadinessResponse['body']>(kibanaVersion.gte('8.0.0') ? '*-apm*' : 'apm-*', {
          size: 0,
          query: { term: { 'service.name': 'app1' } },
          aggs: { required: { filters: { filters: required } } }
        }),
      response => missingData(response).length === 0,
      {
        failFast: ({ status, body }) =>
          ![200, 503].includes(status) &&
          `The APM readiness search failed with HTTP ${status}: ${JSON.stringify(body)}`,
        // Up to 10 s of agent delay, up to 60 s until APM Server writes the 1m metrics, and a margin
        // for a loaded runner.
        timeout: 120000,
        delay: 2000,
        log: response => cy.log(`Missing APM data: ${missingData(response).join(', ')}`),
        error: 'Timed out waiting for the sample APM events in Elasticsearch'
      }
    );
  }

  static openApmInstance(name: string) {
    cy.log('Open APM instance');
    Observability.waitForApmApp(name);
    cy.findByText(name).click();
  }

  static changeApmTransactionType(type: 'request' | 'custom') {
    cy.log('change APM transaction type');
    cy.get('[data-test-subj="headerFilterTransactionType"]').select(type);
  }

  static getApmCustomTransaction(name: string) {
    cy.log(`Get apm custom event`);
    Observability.changeApmTransactionType('custom');
    return cy.findByRole('link', {
      name: name
    });
  }

  static getApmError(name: string) {
    cy.log(`Get apm error`);
    Observability.changeApmTransactionType('request');
    Observability.waitForErrorTransaction(name);
    return cy.findByRole('link', {
      name
    });
  }

  // Waits for the APM UI to show data that Elasticsearch already holds.
  //
  // A refresh cancels every APM request that is still running, and on a loaded runner a panel
  // request takes up to 2 s. So the loop checks every interval, but refreshes only after
  // REFRESH_EVERY_MS without the data, also at its start: the step before it can have started a
  // request already.
  static waitWithRefreshButtonClick({
    targetSelector,
    checkFn,
    timeout = 60000,
    interval = 1000
  }: {
    targetSelector: string;
    checkFn: (selector: JQuery<HTMLElement>) => boolean;
    timeout?: number;
    interval?: number;
  }): Cypress.Chainable<JQuery<HTMLElement>> {
    const refreshButtonSelector = kibanaVersion.gte('8.0.0')
      ? '[data-test-subj="querySubmitButton"]'
      : '[data-test-subj="superDatePickerApplyTimeButton"]';
    let lastRefreshAt = Date.now();

    return recurse(
      () =>
        cy
          .wrap(null, { log: false })
          .then(() => {
            if (Date.now() - lastRefreshAt >= Observability.REFRESH_EVERY_MS) {
              lastRefreshAt = Date.now();
              cy.get(refreshButtonSelector, { log: false }).click({ force: true, log: false });
            }
          })
          .then(() => cy.wait(interval, { log: false }))
          .then(() => Cypress.$(targetSelector) as JQuery<HTMLElement>),
      checkFn,
      {
        // The interval wait sits inside the polled commands, so `delay` would only add a second one.
        delay: 0,
        limit: Math.ceil(timeout / interval) + 1,
        timeout,
        log: false,
        error: `Timed out after ${timeout}ms waiting for condition on ${targetSelector}`
      }
    );
  }

  private static readonly REFRESH_EVERY_MS = 5000;

  static waitForApmData() {
    return this.waitWithRefreshButtonClick({
      targetSelector: '[data-test-subj="headerFilterTransactionType"]',
      checkFn: $el => {
        const value = $el.val();
        return value === 'request' || value === 'custom';
      }
    });
  }

  static waitForApmApp(appName: string) {
    return this.waitWithRefreshButtonClick({
      targetSelector: kibanaVersion.gte('8.0.0') ? '[data-test-subj="apmServiceListAppLink"]' : '.euiLink',
      checkFn: $el => {
        const matches = $el.filter((_, el) => el.textContent.includes(appName));
        return matches.length > 0;
      }
    });
  }

  static waitForErrorTransaction(name: string) {
    return this.waitWithRefreshButtonClick({
      targetSelector: kibanaVersion.gte('8.0.0') ? '[data-test-subj="apmErrorDetailsLink"]' : '.euiLink',
      checkFn: $el => {
        const matches = $el.filter((_, el) => el.innerText.includes(name));

        return matches.length > 0;
      }
    });
  }
}
