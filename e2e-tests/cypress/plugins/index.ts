import https, { Agent } from 'https';
import { createHmac } from 'crypto';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { inspect } from 'util';
import path from 'node:path';
import * as fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { HttpResponse } from '../support/types';

let embeddedServer: ReturnType<typeof https.createServer> | null = null;
const EMBEDDED_SERVER_PORT = 8080;
const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const JWT_SECRET = 'a-string-secret-at-least-256-bits-long';
const ELK_ROR_DIR = path.join(ROOT_DIR, 'environments', 'elk-ror');

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

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Right after a Kibana restart, ROR-KBN can still be finishing its own settings load (an ES
// round trip) while Kibana's core HTTP server already answers requests - a request landing in
// that window gets served the plain Kibana login page instead of the expected JSON API response.
// Retrying a few times rides out that window instead of failing the whole run on it. Only the
// content-type is inspected here (not the body), so the response stream is left untouched for
// the caller to read exactly as before.
// `createInit` is a factory (not a static object) because a retried attempt needs its own
// request body - a FormData upload's underlying stream can only be read once.
const fetchWithJsonRetry = async (url: string, createInit: () => Parameters<typeof fetch>[1]): Promise<Response> => {
  let response: Response;
  for (let attempt = 1; attempt <= NON_JSON_RETRY_ATTEMPTS; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    response = await fetch(url, createInit());
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

module.exports = (on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) => {
  // A Kibana node that stops answering user requests stays so until it restarts (RORDEV-2283).
  // In CI nobody restarts it, so one failed wait fails the rest of the run.
  const personCanRestartKibana = config.isInteractive;
  let kibanaAnswerFailure: string | undefined;
  const rememberKibanaAnswerFailure = (failure: string) => {
    if (!personCanRestartKibana) {
      kibanaAnswerFailure ??= failure;
    }
    return failure;
  };

  on('task', {
    async httpCall(options: HttpCallOptions): Promise<unknown> {
      const { method, url, headers, body, failOnStatusCode, allowTransportError, fullResponse } = options;

      const agent: Agent = new Agent({
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method'
      });

      try {
        const response: Response = await fetchWithJsonRetry(url, () => ({
          method,
          headers,
          body: body ?? undefined,
          agent,
          redirect: fullResponse ? 'manual' : 'follow'
        }));

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
        if (fullResponse) {
          const responseHeaders: { [key: string]: string } = {};
          response.headers.forEach((value, name) => {
            responseHeaders[name] = value;
          });
          const fullHttpResponse: HttpResponse = { status: response.status, headers: responseHeaders, body: data };
          return fullHttpResponse;
        }
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
          method
        });
        throw error;
      }
    },
    async uploadFile(options: UploadFileOptions): Promise<unknown> {
      const { url, headers, file } = options;

      const agent: Agent = new Agent({
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method'
      });

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
          return { method, headers: combinedHeaders, body: form, agent };
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
          method
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
              } catch {
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
        const server = (https.createServer as any)(sslOptions, (_req: any, res: any) => {
          const jwt = generateJwt({
            sub: 'admin',
            group: ['administrators', 'infosec', 'template'],
            iat: Math.floor(Date.now() / 1000)
          });
          const htmlWithJwt = html.toString().replace(/jwt=[^&"#\s]+/, `jwt=${jwt}`);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlWithJwt);
        });

        // Take ownership only after the port is ours. If listen() fails we keep
        // embeddedServer null, so the next call tries again instead of trusting a dead server.
        server.listen(EMBEDDED_SERVER_PORT, () => {
          embeddedServer = server;
          console.log(`Embedded server started at https://localhost:${EMBEDDED_SERVER_PORT}`);
          resolve(EMBEDDED_SERVER_PORT);
        });

        server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${EMBEDDED_SERVER_PORT} already in use — assuming server is running`);
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
    // Docker environment only. Without a fixture, it puts back the kibana.yml of the environment.
    async setKibanaConfig({ fixture }: { fixture: string | null }): Promise<null> {
      const configFile = fixture
        ? path.join(FIXTURES_DIR, fixture)
        : path.join(ELK_ROR_DIR, 'conf', 'kbn', 'kibana.yml');
      try {
        const { stdout } = await promisify(execFile)(path.join(ELK_ROR_DIR, 'set-kibana-config.sh'), [configFile]);
        console.log(stdout);
      } catch (error) {
        const { stdout, stderr } = error as { stdout?: string; stderr?: string };
        throw new Error(
          `set-kibana-config.sh failed for ${configFile}: ${(error as Error).message}\n${stdout}\n${stderr}`
        );
      }
      return null;
    },
    // A status below 500 counts as an answer, a refusal too. No answer within requestTimeoutMs, or a
    // 5xx, starts the count again. A refused connection or a 5xx comes back at once, so the next
    // request waits a second: that keeps a stopped Kibana from getting thousands of requests.
    async waitForKibanaToAnswer(options: KibanaAnswerWaitOptions): Promise<null> {
      if (kibanaAnswerFailure) {
        throw new Error(`Kibana did not answer in an earlier spec of this suite run. ${kibanaAnswerFailure}`);
      }
      const { url, headers, answersInARow, requestTimeoutMs, totalTimeoutMs } = options;
      const pauseAfterFailureMs = 1000;
      const agent: Agent = new Agent({ rejectUnauthorized: false, secureProtocol: 'TLSv1_2_method' });
      const deadline = Date.now() + totalTimeoutMs;
      const outcomes: string[] = [];
      let answers = 0;

      while (answers < answersInARow) {
        const timeLeft = deadline - Date.now();
        if (timeLeft <= 0) {
          throw new Error(
            rememberKibanaAnswerFailure(
              `Kibana did not answer ${answersInARow} requests in a row within ${totalTimeoutMs} ms. ` +
                `GET ${url}: ${outcomes.join(', ')}`
            )
          );
        }
        const startedAt = Date.now();
        try {
          const response = await fetch(url, { headers, agent, timeout: Math.min(requestTimeoutMs, timeLeft) });
          await response.text();
          outcomes.push(`${response.status} in ${Date.now() - startedAt} ms`);
          answers = response.status < 500 ? answers + 1 : 0;
        } catch (error) {
          outcomes.push(`${(error as Error).message} after ${Date.now() - startedAt} ms`);
          answers = 0;
        }
        if (answers === 0) {
          await new Promise(resolve => setTimeout(resolve, Math.min(pauseAfterFailureMs, deadline - Date.now())));
        }
      }

      console.log(`Kibana answered ${answersInARow} requests in a row: GET ${url}: ${outcomes.join(', ')}`);
      return null;
    }
  });

  // failed-specs.tsv keeps one row per failed spec (start time of this suite run, spec), so that a
  // CI step can report the failed specs. Each suite run appends after each spec, so a run stopped at
  // a timeout keeps its rows.
  const resultsDir = path.resolve(config.projectRoot, '..', 'results');
  const suiteRunStarted = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const recordFailedSpec = async (spec: Cypress.Spec) => {
    // A tab or a line break in the spec name would split the row.
    const row = [suiteRunStarted, path.basename(spec.relative)].map(cell => cell.replace(/[\t\r\n]+/g, ' '));
    try {
      await fs.promises.mkdir(resultsDir, { recursive: true });
      await fs.promises.appendFile(path.join(resultsDir, 'failed-specs.tsv'), row.join('\t') + '\n');
    } catch {
      // A broken report must never fail a suite that passed.
    }
  };

  // The same count gives the ✖ in the "Run Finished" table. `error` is a spec-level error, which
  // can come without a failed test.
  const specFailed = (results: CypressCommandLine.RunResult) =>
    (results.stats && results.stats.failures > 0) || Boolean(results.error);

  // Cypress keeps one handler per event name: a second `on('after:spec')` replaces the first.
  // So both jobs live in this one handler.
  on('after:spec', async (spec, results) => {
    if (!results) return;
    if (specFailed(results)) {
      await recordFailedSpec(spec);
      return;
    }
    // Keep the video of a failed spec only. With `videoCompression: false` in cypress.config.ts,
    // the videos of passed specs would fill GBs of disk and artifacts.
    if (!results.video) return;
    try {
      await fs.promises.unlink(results.video);
    } catch {
      // The file can be gone already. A cleanup must not fail the run.
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
  // Answer the status, headers and body, and do not follow redirects, so that a redirect to the login
  // page stays visible.
  fullResponse?: boolean;
}

interface KibanaAnswerWaitOptions {
  url: string;
  headers: { [key: string]: string };
  answersInARow: number;
  requestTimeoutMs: number;
  totalTimeoutMs: number;
}

interface FileToUpload {
  fileName: string;
  fileBinaryContent: string;
}

interface UploadFileOptions {
  url: string;
  headers?: { [key: string]: string };
  file: FileToUpload;
}
