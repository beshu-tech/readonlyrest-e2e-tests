// The gate in front of the suite. It runs once, before `node --test`, so that an environment that
// is not there costs one bounded wait instead of one full request deadline per test.
//
// The docker environment already has this gate: `docker compose up --wait`
// (environments/elk-ror/start.sh:208) blocks on the kbn-ror and kbn-proxy healthchecks
// (environments/elk-ror/base.docker-compose.yml:60 and :89), which GET /api/status through
// ReadonlyREST's Kibana proxy. The ECK environment has no such gate: its wait
// (environments/eck-ror/start.sh:292-326) reads `kubectl get pods` only, and a Kibana pod turns
// Ready on a probe that ReadonlyREST's proxy answers by itself, before Kibana behind it serves the
// API. So this check asks the published address the same question the docker healthcheck asks.

import {
  elasticsearchUrl,
  envName,
  kibanaUrl,
  kibanaUserCredentials,
  readinessTimeoutMs,
  requestTimeoutMs
} from './config.js';
import { probe } from './http-client.js';

const RETRY_DELAY_MS = 2000;

// /api/status is a proxied path, not one ReadonlyREST's Kibana proxy serves on its own, so a 2xx
// there means Kibana itself answers. Elasticsearch only has to answer at all: which status the ACL
// in force gives this account is not this check's business.
const targets = [
  { name: 'Elasticsearch', url: `${elasticsearchUrl}/`, isReady: status => status < 500 },
  { name: 'Kibana', url: `${kibanaUrl}/api/status`, isReady: status => status >= 200 && status < 300 }
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor({ name, url, isReady }, startedAt, deadline) {
  let attempts = 0;
  let last = 'nothing yet';

  do {
    attempts += 1;
    // Never overrun the budget: the last attempt gets whatever is left of it, and no more.
    const remaining = deadline - Date.now();
    const { status, reason } = await probe(url, kibanaUserCredentials, Math.min(requestTimeoutMs, remaining));

    if (status !== undefined && isReady(status)) {
      console.log(`${name} answers at ${url} (HTTP ${status}, after ${Date.now() - startedAt}ms).`);
      return;
    }

    last = status !== undefined ? `HTTP ${status}` : reason;
    if (Date.now() + RETRY_DELAY_MS >= deadline) break;
    await sleep(RETRY_DELAY_MS);
  } while (Date.now() < deadline);

  throw new Error(
    `${name} is not ready at ${url}: ${attempts} attempt(s) in ${Date.now() - startedAt}ms, last answer: ${last}. ` +
      `Environment: ${envName}. The HTTP API suite needs a stack that serves that address; runner.sh starts one. ` +
      'Raise HTTP_READINESS_TIMEOUT_MS if this stack is only slow.'
  );
}

const startedAt = Date.now();
const deadline = startedAt + readinessTimeoutMs;

try {
  for (const target of targets) {
    await waitFor(target, startedAt, deadline);
  }
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
