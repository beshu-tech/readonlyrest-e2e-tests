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
  on('task', {
    async httpCall(options: HttpCallOptions): Promise<any> {
      const { method, url, headers, body, failOnStatusCode } = options;

      const agent: Agent = new Agent({
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method'
      });

      try {
        const response: Response = await fetch(url, { method, headers, body, agent });

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
        embeddedServer = (https.createServer as any)(sslOptions, (_req: any, res: any) => {
          const jwt = generateJwt({
            sub: 'admin',
            group: ['administrators', 'infosec', 'template'],
            iat: Math.floor(Date.now() / 1000)
          });
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
    }
  });
};

interface HttpCallOptions {
  method: string;
  url: string;
  headers?: { [key: string]: string };
  body: string | null;
  failOnStatusCode?: boolean;
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
