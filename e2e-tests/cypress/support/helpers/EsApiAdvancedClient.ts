import { recurse } from 'cypress-recurse';
import { EsApiClient } from './EsApiClient';

export class EsApiAdvancedClient extends EsApiClient {
  public pruneAllReportingIndices(): void {
    cy.log('Pruning all reporting indices...');

    // Reporting has used data streams (.kibana-reporting-*, backed by hidden
    // .ds-* indices) since 8.15; drop them in every version so stale docs from a
    // prior run can't satisfy waitForReportingSegmentsDocsCount before the current
    // export lands. No-op when none exist.
    this.dataStreams().then(result => {
      result.data_streams
        .filter(dataStream => dataStream.name.startsWith('.kibana-reporting-'))
        .forEach(reportingDataStream => {
          this.deleteDataStream(reportingDataStream.name);
        });
    });

    // The legacy .reporting* indices hold reports too, in every version: the reporting page lists
    // what it finds in both places, and a test writes an old-format doc to prove it. Purge their
    // docs as well, or a report the page still shows outlives the test that made it.
    this.indices().then(result => {
      result
        .filter(index => index.index.startsWith('.reporting'))
        .forEach(reportingIndex => {
          this.deleteIndexDocsByQuery(reportingIndex.index);
          this.refreshIndex(reportingIndex.index);
        });
    });

    cy.log('Pruning all reporting indices - DONE!');
  }

  /**
   * Backdates every session so the cleanup task deletes it on its next pass, instead of waiting out
   * session_timeout_minutes. `expiresAt` is the field the v1 session codec writes and the range
   * query in server/SessionCleanupTaskManager.ts selects on: rename it there and this stops working.
   *
   * One backdate is not enough: the proxy rolls expiresAt forward on authenticated traffic
   * (sessionManager.refreshSession), so a background Kibana request can rescue the document
   * before the cleanup tick — or make this update a version-conflict no-op, which is why
   * conflicts=proceed. The loop re-backdates until the sweep wins, bounded by `attempts`.
   */
  public expireAllSessionsUntilSwept(index: string, timeout = 20000, interval = 1500): Cypress.Chainable<number> {
    return recurse(
      () => {
        this.expireAllSessions(index);
        return this.findIndicesByPattern(index).then(result => {
          const found = result.find(({ index: name }) => name === index);
          return found ? Number.parseInt(found['docs.count'], 10) : 0;
        });
      },
      count => count === 0,
      {
        timeout,
        // The cleanup interval in the fixture is 1s, so each pass gives one tick a chance to run.
        delay: interval,
        log: count => cy.log(`Sessions left in ${index}: ${count}`),
        error: `Sessions in ${index} survived repeated backdating`
      }
    );
  }

  private expireAllSessions(index: string): void {
    cy.log(`Expiring all sessions in ${index}...`);
    cy.esPost({
      endpoint: `${index}/_update_by_query?refresh=true&conflicts=proceed`,
      credentials: Cypress.env().kibanaUserCredentials,
      payload: {
        script: { source: 'ctx._source.expiresAt = 0' },
        query: { match_all: {} }
      }
    });
  }

  /**
   * Prune, then wait until the report store is actually empty.
   *
   * pruneAllReportingIndices fires the deletes and returns. That is enough for a report that has
   * already landed and not enough for one a previous attempt left QUEUED: exportToCsv returns when
   * Kibana accepts the job, not when it writes it (see Discover.exportToCsv), so on a retry the
   * earlier report can arrive just after the prune and make the next count assertion fail with the
   * "Too many elements found" this is meant to prevent.
   *
   * Polling closes that window rather than sealing it. A report queued after the last poll can
   * still arrive; draining Kibana's task manager is the only way to rule that out, and no test
   * needs that today.
   */
  public pruneAllReportingIndicesUntilEmpty(timeout = 20000, interval = 1000): Cypress.Chainable<number> {
    this.pruneAllReportingIndices();

    return recurse(
      () => this.reportingDocsCount(),
      total => total === 0,
      {
        timeout,
        delay: interval,
        log: total => cy.log(`Reporting docs still present: ${total}`),
        error: 'Timeout waiting for the reporting store to be empty'
      }
    );
  }

  /**
   * Documents in every place a report can live: the legacy `.reporting*` indices, which the prune
   * empties but does not delete, and the `.ds-.kibana-reporting-*` segments behind the data
   * streams, which it does delete. One `_cat/indices` pass covers both.
   */
  public reportingDocsCount(): Cypress.Chainable<number> {
    return this.indices().then(result =>
      result
        .filter(index => index.index.startsWith('.reporting') || index.index.startsWith('.ds-.kibana-reporting-'))
        .reduce((sum, index) => sum + Number.parseInt(index['docs.count'] ?? '0', 10), 0)
    );
  }

  public getAllReportingIndices() {
    cy.log('Getting all reporting indices...');
    return this.indices().then(result => result.filter(index => index.index.startsWith('.reporting')));
  }

  public getAllReportingDataStreamSegments(indexName: string) {
    cy.log('Getting all reporting data stream segments...');
    return this.indices().then(result =>
      result.filter(index => index.index.startsWith(`.ds-.kibana-reporting-${indexName}`))
    );
  }

  // exportToCsv returns when the report is QUEUED, not written. Poll the segments'
  // combined docs.count (refresh-visible) until the report doc shows up, so a
  // following rollover doesn't race the write and land the report in the wrong segment.
  public waitForReportingSegmentsDocsCount(
    indexName: string,
    expectedDocs: number,
    timeout = 30000,
    interval = 1000
  ): Cypress.Chainable<number> {
    return recurse(
      () =>
        this.getAllReportingDataStreamSegments(indexName).then(segments =>
          segments.reduce((sum, seg) => sum + Number.parseInt(seg['docs.count'] ?? '0', 10), 0)
        ),
      total => total >= expectedDocs,
      {
        timeout,
        delay: interval,
        log: total => cy.log(`Reporting segments for ${indexName}: docs ${total}/${expectedDocs}`),
        error: `Timeout waiting for ${expectedDocs} report docs in ${indexName} segments`
      }
    );
  }

  public waitForDocsCount(
    indexName: string,
    expectedCount = 0,
    timeout = 10000,
    interval = 1000
  ): Cypress.Chainable<number> {
    cy.log(`Waiting for index ${indexName} to have ${expectedCount} documents...`);

    return recurse(
      () =>
        this.findIndicesByPattern(indexName).then(result => {
          const foundIndex = result.find(({ index }) => index === indexName);
          // Thrown from the polled command rather than the predicate, so it fails the test outright
          // instead of being retried: a missing index will not appear by waiting.
          if (!foundIndex) {
            throw new Error(`Index ${indexName} not found`);
          }
          return Number.parseInt(foundIndex['docs.count'], 10);
        }),
      currentCount => currentCount === expectedCount,
      {
        timeout,
        delay: interval,
        log: currentCount =>
          cy.log(`Index: ${indexName}, Current docs.count: ${currentCount}, Expected: ${expectedCount}`),
        error: `Timeout waiting for docs.count of ${indexName} to be ${expectedCount}`
      }
    );
  }

  public deleteIndicesByPattern(pattern: string): void {
    cy.log(`Deleting indices matching pattern ${pattern}...`);
    this.indices().then(result => {
      const regex = new RegExp(pattern);
      const matchingIndices = result.filter(indexObj => regex.test(indexObj.index));
      matchingIndices.forEach(matchingIndex => {
        cy.log(`Deleting index ${matchingIndex.index}...`);
        this.deleteIndex(matchingIndex.index);
      });
    });
  }

  public deleteDataStreamsByPattern(pattern: string): void {
    cy.log(`Deleting data streams matching pattern ${pattern}...`);
    this.dataStreams().then(result => {
      const regex = new RegExp(pattern);
      const matchingIndices = result.data_streams.filter(indexObj => regex.test(indexObj.name));
      matchingIndices.forEach(matchingIndex => {
        cy.log(`Deleting index ${matchingIndex.name}...`);
        this.deleteDataStream(matchingIndex.name);
      });
    });
  }
}

export const esApiAdvancedClient = new EsApiAdvancedClient();
