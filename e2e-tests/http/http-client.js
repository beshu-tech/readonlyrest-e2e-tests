import tls from 'node:tls';
import { readFile } from 'node:fs/promises';
import { elasticsearchUrl, kibanaUrl, requestTimeoutMs } from './config.js';

// cypress/plugins/index.ts gives every call an agent built with `rejectUnauthorized: false` and
// `secureProtocol: 'TLSv1_2_method'`. The stack serves a self-signed certificate, so without the
// first one every request fails. The built-in fetch takes no agent, so the same two settings go on
// the process instead: undici reads both when it opens the socket.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
tls.DEFAULT_MIN_VERSION = 'TLSv1.2';
tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const fixturesDir = new URL('../cypress/fixtures/', import.meta.url);

const basicAuth = credentials => `Basic ${Buffer.from(credentials).toString('base64')}`;

const describeBody = data => {
  const shown = typeof data === 'string' ? data : JSON.stringify(data);
  return shown.length > 2000 ? `${shown.slice(0, 2000)}…` : shown;
};

/**
 * Node exports no dispatcher, so undici's headersTimeout and bodyTimeout stay at their 300s
 * defaults and cannot be lowered. One deadline over the whole call does the same job: the signal
 * covers the connection, the headers and the body, and it fires as a TimeoutError.
 */
const deadline = (timeoutMs = requestTimeoutMs) => AbortSignal.timeout(timeoutMs);

const describeFailure = (error, timeoutMs = requestTimeoutMs) =>
  error.name === 'TimeoutError'
    ? `no answer in ${timeoutMs}ms`
    : // ECONNREFUSED arrives as an AggregateError with an empty message, so take the code first.
      error.cause?.code || error.cause?.message || error.message;

/**
 * A transport error here means the stack is not there, which is the first thing a reader needs to
 * know. `fetch` reports all of them as the same 'fetch failed', with the address only in `cause`.
 */
async function send(method, url, options) {
  try {
    return await fetch(url, { ...options, signal: deadline() });
  } catch (error) {
    throw new Error(
      `Cannot reach ${method} ${url} (${describeFailure(error)}). The suite needs a running ELK stack with ` +
        'ReadonlyREST — runner.sh starts one.',
      { cause: error }
    );
  }
}

async function readBody(response, method, url, failOnStatusCode) {
  const contentType = response.headers.get('content-type') || '';

  let data;
  try {
    data = contentType.includes('application/json') ? await response.json() : await response.text();
  } catch (error) {
    // The deadline covers the body too, so a stack that sends headers and then stalls ends here.
    throw new Error(`Cannot read the answer of ${method} ${url} (${describeFailure(error)}).`, { cause: error });
  }

  if (!response.ok && failOnStatusCode) {
    throw new Error(`HTTP error: ${method} ${url}: HTTP STATUS ${response.status}; Body: ${describeBody(data)}`);
  }

  return data;
}

async function httpCall({ method, url, credentials, payload, headers, failOnStatusCode = true }) {
  const response = await send(method, url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      authorization: basicAuth(credentials),
      ...headers
    },
    body: payload === undefined || payload === null ? undefined : JSON.stringify(payload)
  });

  return readBody(response, method, url, failOnStatusCode);
}

/**
 * One attempt, status only, for the readiness check: it needs to know whether the address answers
 * at all, not what it said. The body is drained because an unread one holds the socket open.
 */
export async function probe(url, credentials, timeoutMs = requestTimeoutMs) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { authorization: basicAuth(credentials), 'kbn-xsrf': 'true' },
      signal: deadline(timeoutMs)
    });
    await response.arrayBuffer();
    return { status: response.status };
  } catch (error) {
    return { reason: describeFailure(error, timeoutMs) };
  }
}

// The headers cypress/support/commands.ts puts on every Kibana call.
function kibanaHeaders({ group, impersonating, headers }) {
  return {
    'kbn-xsrf': 'true',
    ...headers,
    ...(group ? { 'x-ror-tenancy-id': group } : {}),
    ...(impersonating ? { 'x-ror-impersonating': impersonating } : {})
  };
}

function kbnRequest(method, { endpoint, credentials, payload, group, impersonating, failOnStatusCode, headers }) {
  return httpCall({
    method,
    url: `${kibanaUrl}/${endpoint}`,
    credentials,
    payload,
    headers: kibanaHeaders({ group, impersonating, headers }),
    failOnStatusCode
  });
}

export const kbnGet = options => kbnRequest('GET', options);
export const kbnPost = options => kbnRequest('POST', options);
export const kbnDelete = options => kbnRequest('DELETE', options);

export const esPost = ({ endpoint, credentials, payload, failOnStatusCode }) =>
  httpCall({ method: 'POST', url: `${elasticsearchUrl}/${endpoint}`, credentials, payload, failOnStatusCode });

export const readFixture = fixtureFilename => readFile(new URL(fixtureFilename, fixturesDir), 'utf8');

/**
 * The multipart upload that cypress/support/commands.ts does with form-data. Kibana's import
 * endpoint reads the part named `file` and takes the saved-object format from its filename.
 */
export async function kbnImport({ endpoint, credentials, fixtureFilename, group }) {
  const fileContent = await readFile(new URL(fixtureFilename, fixturesDir));

  const form = new FormData();
  form.append('file', new Blob([fileContent], { type: 'application/octet-stream' }), fixtureFilename);

  const url = `${kibanaUrl}/${endpoint}`;
  // No Content-Type of ours: fetch writes it, with the boundary it generated for this body.
  const response = await send('POST', url, {
    method: 'POST',
    headers: {
      authorization: basicAuth(credentials),
      'kbn-xsrf': 'true',
      ...(group ? { 'x-ror-tenancy-id': group } : {})
    },
    body: form
  });

  return readBody(response, 'POST', url, true);
}
