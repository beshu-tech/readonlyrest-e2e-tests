import https, { Agent } from 'https';
import { createHmac } from 'crypto';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { inspect } from 'util';
import path from 'node:path';
import * as fs from 'node:fs';

// Shared and kept alive across calls so requests reuse an established TCP+TLS connection instead
// of each `httpCall`/`uploadFile` negotiating a brand-new one. In the eck-ror CI environment,
// Kibana is reached through kind's NodePort/iptables overlay rather than a direct docker port
// mapping, and that extra hop is where the many short-lived connections a fresh Agent-per-call
// created were most likely to get dropped or hang.
const sharedHttpsAgent: Agent = new Agent({
  rejectUnauthorized: false,
  secureProtocol: 'TLSv1_2_method',
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50
});

let embeddedServer: ReturnType<typeof https.createServer> | null = null;
const EMBEDDED_SERVER_PORT = 8080;
const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const JWT_SECRET = 'a-string-secret-at-least-256-bits-long';

const generateJwt = (payload: object): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
};

const formatLoggerData = (data: unknown) =>
  inspect(data, {
    depth: 5,
    breakLength: Infinity,
    maxArrayLength: Infinity,
    maxStringLength: Infinity,
    compact: true
  });

const NON_JSON_RETRY_ATTEMPTS = 5;
const NON_JSON_RETRY_DELAY_MS = 2000;

// The eck-ror CI environment reaches Kibana through kind's NodePort/iptables overlay instead of
// a direct docker port mapping, which occasionally drops or hangs a TCP connection outright
// (ECONNRESET, socket hang up) rather than serving a slow-but-valid response. Without a retry
// here, a single dropped connection burns the whole cy.task timeout and, since Cypress only
// prints failures once the spec finishes, can silently take the rest of the spec down with it.
const TRANSPORT_ERROR_RETRY_ATTEMPTS = 3;
const TRANSPORT_ERROR_RETRY_DELAY_MS = 1000;
// Without a per-request timeout, a socket that hangs instead of dropping outright (no
// ECONNRESET, just silence) burns the entire cy.task `taskTimeout` (20000ms) on its first
// attempt, so the retry loop above never even gets a chance to run. Capping each attempt well
// under a third of that budget guarantees all TRANSPORT_ERROR_RETRY_ATTEMPTS attempts (plus their
// TRANSPORT_ERROR_RETRY_DELAY_MS sleeps) fit inside taskTimeout even in the worst case.
const FETCH_TIMEOUT_MS = 5000;
const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH'
]);

const isTransientNetworkError = (error: unknown): boolean => {
  const err = error as { code?: string; type?: string; message?: string };
  if (err?.code && TRANSIENT_NETWORK_ERROR_CODES.has(err.code)) {
    return true;
  }
  // node-fetch's own `timeout` option (set via FETCH_TIMEOUT_MS above) surfaces as a
  // FetchError with type 'request-timeout' rather than one of the Node error codes above.
  if (err?.type === 'request-timeout') {
    return true;
  }
  return typeof err?.message === 'string' && err.message.includes('socket hang up');
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Right after a Kibana restart, ROR-KBN can still be finishing its own settings load (an ES
// round trip) while Kibana's core HTTP server already answers requests - a request landing in
// that window gets served the plain Kibana login page instead of the expected JSON API response.
// Retrying a few times rides out that window instead of failing the whole run on it. Only the
// content-type is inspected here (not the body), so the response stream is left untouched for
// the caller to read exactly as before.
// `createInit` is a factory (not a static object) because a retried attempt needs its own
// request body - a FormData upload's underlying stream can only be read once.
//
// `retryOnTransportError` is off for calls that intentionally expect the connection to be reset
// (e.g. /pkp/api/kibanaConfig SIGINTs Kibana before writing its reply) - those should fail fast
// into the caller's own handling instead of burning retries on an error that's the expected outcome.
const fetchWithJsonRetry = async (
  url: string,
  createInit: () => Parameters<typeof fetch>[1],
  retryOnTransportError = true
): Promise<Response> => {
  let response: Response;
  for (let attempt = 1; attempt <= NON_JSON_RETRY_ATTEMPTS; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    response = await fetchWithTransportRetry(url, createInit, retryOnTransportError);
    const contentType = response.headers.get('content-type') || '';

    // The startup race serves Kibana's login page (text/html) in place of the expected
    // response - that's the only shape worth retrying. Endpoints legitimately answer with
    // all sorts of non-JSON content (204 empty, application/octet-stream, plain text, ...),
    // and retrying those turns an already-succeeded call (e.g. DELETE) into a second request
    // that 404s once the first one already took effect.
    const looksLikeStartupRace = contentType.includes('text/html');

    if (!looksLikeStartupRace || attempt === NON_JSON_RETRY_ATTEMPTS) {
      return response;
    }

    console.log(
      `Got HTML response (content-type: ${
        contentType || 'none'
      }) for ${url} - ROR-KBN might still be starting up. Retrying (${attempt}/${NON_JSON_RETRY_ATTEMPTS})...`
    );
    // eslint-disable-next-line no-await-in-loop
    await sleep(NON_JSON_RETRY_DELAY_MS);
  }

  return response!;
};

const fetchWithTransportRetry = async (
  url: string,
  createInit: () => Parameters<typeof fetch>[1],
  retryOnTransportError: boolean
): Promise<Response> => {
  for (let attempt = 1; attempt <= TRANSPORT_ERROR_RETRY_ATTEMPTS; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fetch(url, { timeout: FETCH_TIMEOUT_MS, ...createInit() });
    } catch (error) {
      const isLastAttempt = attempt === TRANSPORT_ERROR_RETRY_ATTEMPTS;
      if (!retryOnTransportError || !isTransientNetworkError(error) || isLastAttempt) {
        throw error;
      }
      console.log(
        `Transient network error (${
          (error as Error).message
        }) for ${url} - retrying (${attempt}/${TRANSPORT_ERROR_RETRY_ATTEMPTS})...`
      );
      // A transient error on one request can leave other keep-alive sockets in the shared pool
      // half-broken too (the same kind NodePort hop dropped them all around the same time), and a
      // retry that happens to grab one of those instead of opening a fresh connection fails the
      // same way. Destroying the whole pool forces the retry onto a brand-new TCP+TLS connection.
      sharedHttpsAgent.destroy();
      // eslint-disable-next-line no-await-in-loop
      await sleep(TRANSPORT_ERROR_RETRY_DELAY_MS);
    }
  }
  // Unreachable: the loop above always either returns or throws.
  throw new Error(`Unreachable: exhausted retries for ${url} without returning or throwing`);
};

module.exports = (on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) => {
  on('task', {
    async httpCall(options: HttpCallOptions): Promise<any> {
      const { method, url, headers, body, failOnStatusCode, allowTransportError } = options;

      try {
        const response: Response = await fetchWithJsonRetry(
          url,
          () => ({
            method,
            headers,
            body: body ?? undefined,
            agent: sharedHttpsAgent
          }),
          !allowTransportError
        );

        if (!response.ok && failOnStatusCode) {
          throw new Error(
            `HTTP error: ${method} ${url}: HTTP STATUS ${response.status}; Body: ${formatLoggerData(
              await response.text()
            )}`
          );
        }

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await response.json() : await response.text();

        console.log(`Response: ${method} ${url}: HTTP STATUS ${response.status}; Body: ${formatLoggerData(data)}`);
        return data;
      } catch (error) {
        if (allowTransportError) {
          // /pkp/api/kibanaConfig SIGINTs Kibana and only then writes its 200, so the socket is
          // reset before the reply lands. Losing the reply is the normal outcome, not a failure —
          // the caller confirms the change by waiting for Kibana to come back up.
          console.log(`Transport error tolerated for ${method} ${url}: ${(error as Error).message}`);
          return { status: 'TRANSPORT_ERROR', message: (error as Error).message };
        }
        console.error('HTTP Request failed:', {
          error: (error as Error).message,
          url,
          method,
          headers,
          body
        });
        throw error;
      }
    },
    async uploadFile(options: UploadFileOptions): Promise<any> {
      const { url, headers, file } = options;

      const buildForm = (): { form: FormData; combinedHeaders: { [key: string]: string } } => {
        const form = new FormData();
        form.append('file', file.fileBinaryContent, {
          filename: file.fileName,
          contentType: 'application/ndjson'
        });

        return { form, combinedHeaders: { ...headers, ...form.getHeaders() } };
      };

      const method = 'POST';

      try {
        const response: Response = await fetchWithJsonRetry(url, () => {
          const { form, combinedHeaders } = buildForm();
          return { method, headers: combinedHeaders, body: form, agent: sharedHttpsAgent };
        });

        if (!response.ok) {
          throw new Error(
            `HTTP error! Status: ${response.status} | URL: ${url} | Body: ${formatLoggerData(await response.text())}`
          );
        }

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await response.json() : await response.text();

        console.log(`Response: ${method} ${url}: HTTP STATUS ${response.status}; Body: ${formatLoggerData(data)}`);
        return data;
      } catch (error) {
        console.error('HTTP Request failed:', {
          error: (error as Error).message,
          url,
          headers,
          file
        });
        throw error;
      }
    },
    checkKibanaHealth({ url }) {
      return new Promise(resolve => {
        const req = https.request(
          `${url}/api/status`,
          {
            method: 'GET',
            rejectUnauthorized: false,
            headers: {
              'kbn-xsrf': 'true'
            }
          },
          res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
              try {
                const json = JSON.parse(data);
                resolve(json.status?.overall?.level || json.status.overall.state || 'unknown');
              } catch (e) {
                resolve('parse-error');
              }
            });
          }
        );

        req.on('error', () => resolve('error'));
        req.end();
      });
    },
    startEmbeddedServer(): Promise<number> {
      if (embeddedServer) return Promise.resolve(EMBEDDED_SERVER_PORT);
      const certDir = path.join(ROOT_DIR, 'environments', 'elk-ror', 'certs');
      const sslOptions = {
        key: fs.readFileSync(path.join(certDir, 'kibana.key')),
        cert: fs.readFileSync(path.join(certDir, 'kibana.crt')),
        rejectUnauthorized: false
      };
      const html = fs.readFileSync(path.join(FIXTURES_DIR, 'embedded.html'));

      return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        embeddedServer = (https.createServer as any)(sslOptions, (_req: any, res: any) => {
          const jwt = generateJwt({ sub: 'admin', group: ['administrators', 'infosec', 'template'], iat: Math.floor(Date.now() / 1000) });
          const htmlWithJwt = html.toString().replace(/jwt=[^&"#\s]+/, `jwt=${jwt}`);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlWithJwt);
        });

        embeddedServer.listen(EMBEDDED_SERVER_PORT, () => {
          console.log(`Embedded server started at https://localhost:${EMBEDDED_SERVER_PORT}`);
          resolve(EMBEDDED_SERVER_PORT);
        });

        embeddedServer.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${EMBEDDED_SERVER_PORT} already in use — assuming server is running`);
            embeddedServer = null;
            resolve(EMBEDDED_SERVER_PORT);
          } else {
            reject(err);
          }
        });
      });
    },
    stopEmbeddedServer(): Promise<null> {
      return new Promise(resolve => {
        if (!embeddedServer) {
          resolve(null);
          return;
        }
        embeddedServer.closeAllConnections?.();
        embeddedServer.close(() => {
          embeddedServer = null;
          console.log('Embedded server stopped');
          resolve(null);
        });
      });
    },
    generateJwt(payload: object): string {
      return generateJwt(payload);
    },
    async clearDownloads() {
      const downloadsFolder = path.join('cypress', 'downloads');
      console.log('🧹 Starting to clear the downloads folder:', downloadsFolder);

      try {
        await fs.promises.rm(downloadsFolder, { recursive: true, force: true });
        console.log('✅ Downloads folder cleared successfully.');

        await fs.promises.mkdir(downloadsFolder, { recursive: true });
        console.log('📁 Created a new empty downloads folder.');
      } catch (err) {
        console.error('❌ Error while clearing the downloads folder:', err);
      }

      return null;
    },
    async listDownloadedFiles() {
      const downloadsFolder = path.join('cypress', 'downloads');
      try {
        return await fs.promises.readdir(downloadsFolder);
      } catch {
        return [];
      }
    }
  });

  // Discard the video for specs that finished with all tests passing.
  // Combined with `videoCompression: false` in cypress.config.ts, this keeps
  // failure-debug videos available while avoiding writing GBs of green-run
  // videos to disk and uploading them as artifacts.
  on('after:spec', async (_spec, results) => {
    if (!results || !results.video) return;
    // Keep the video if the spec had ANY failure. Prefer the stable
    // `results.stats.failures` counter — in Cypress 14 the per-attempt
    // `tests[].attempts[].state` field is no longer reliably populated, so the
    // old `attempts[].state === 'failed'` check returned false even for failed
    // specs and the failure video was wrongly deleted before upload.
    const failures =
      (results.stats && results.stats.failures > 0) ||
      (results.tests || []).some((t) =>
        t.state === 'failed' ||
        (t.attempts || []).some((a) => a.state === 'failed')
      );
    if (failures) return;
    try {
      await fs.promises.unlink(results.video);
    } catch {
      // best-effort cleanup; don't fail the run if the file is already gone
    }
  });
};

interface HttpCallOptions {
  method: string;
  url: string;
  headers?: { [key: string]: string };
  body: string | null;
  failOnStatusCode?: boolean;
  // For endpoints that restart the server they answer from, so the reply is lost by design.
  allowTransportError?: boolean;
}

interface FileToUpload {
  fileName: string;
  fileBinaryContent: any;
}

interface UploadFileOptions {
  url: string;
  headers?: { [key: string]: string };
  file: FileToUpload;
}
