import https, { Agent } from 'https';
import { createHmac } from 'crypto';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { inspect } from 'util';
import path from 'node:path';
import * as fs from 'node:fs';

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

module.exports = (on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) => {
  // The error of the first failed wait for Kibana answers. A node that does not answer user requests
  // stays so until it restarts (RORDEV-2283), and CI does not restart it. So the later specs of
  // this suite run fail at once with this error, and do not wait again.
  let kibanaAnswerFailure: string | undefined;

  on('task', {
    async httpCall(options: HttpCallOptions): Promise<any> {
      const { method, url, headers, body, failOnStatusCode, allowTransportError } = options;

      const agent: Agent = new Agent({
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method'
      });

      try {
        const response: Response = await fetch(url, { method, headers, body: body ?? undefined, agent });

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

      const agent: Agent = new Agent({
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method'
      });

      const form = new FormData();
      form.append('file', file.fileBinaryContent, {
        filename: file.fileName,
        contentType: 'application/octet-stream'
      });

      const combinedHeaders: { [key: string]: string } = {
        ...headers,
        ...form.getHeaders()
      };

      const method = 'POST';

      try {
        const response: Response = await fetch(url, {
          method,
          headers: combinedHeaders,
          body: form,
          agent
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
          combinedHeaders,
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
          kibanaAnswerFailure =
            `Kibana did not answer ${answersInARow} requests in a row within ${totalTimeoutMs} ms. ` +
            `GET ${url}: ${outcomes.join(', ')}`;
          throw new Error(kibanaAnswerFailure);
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
  // A tab or a line break in a cell would split the row.
  const cell = (text: string) => text.replace(/[\t\r\n]+/g, ' ');
  const appendRows = async (file: string, rows: (string | number)[][]) => {
    if (rows.length === 0) return;
    try {
      await fs.promises.mkdir(resultsDir, { recursive: true });
      await fs.promises.appendFile(
        path.join(resultsDir, file),
        rows.map(row => row.map(value => cell(String(value))).join('\t') + '\n').join('')
      );
    } catch {
      // A broken report must never fail a suite that passed.
    }
  };
  const reportFlakes = async (spec: Cypress.Spec, results: CypressCommandLine.RunResult) => {
    if (!results) return;
    const specName = path.basename(spec.relative);

    // The same count gives the ✖ in the "Run Finished" table. `error` is a spec-level error, which
    // can come without a failed test.
    if ((results.stats && results.stats.failures > 0) || results.error) {
      await appendRows('failed-specs.tsv', [[suiteRunStarted, specName]]);
    }
  };

  // Discard the video for specs that finished with all tests passing.
  // Combined with `videoCompression: false` in cypress.config.ts, this keeps
  // failure-debug videos available while avoiding writing GBs of green-run
  // videos to disk and uploading them as artifacts.
  on('after:spec', async (spec, results) => {
    // Cypress keeps one handler per event name: a second `on('after:spec')` replaces the first.
    // So both jobs live in this one handler.
    await reportFlakes(spec, results);

    if (!results || !results.video) return;
    // Keep the video if the spec had ANY failure. Prefer the stable
    // `results.stats.failures` counter — in Cypress 14 the per-attempt
    // `tests[].attempts[].state` field is no longer reliably populated, so the
    // old `attempts[].state === 'failed'` check returned false even for failed
    // specs and the failure video was wrongly deleted before upload.
    const failures =
      (results.stats && results.stats.failures > 0) ||
      (results.tests || []).some(t => t.state === 'failed' || (t.attempts || []).some(a => a.state === 'failed'));
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

interface KibanaAnswerWaitOptions {
  url: string;
  headers: { [key: string]: string };
  answersInARow: number;
  requestTimeoutMs: number;
  totalTimeoutMs: number;
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
