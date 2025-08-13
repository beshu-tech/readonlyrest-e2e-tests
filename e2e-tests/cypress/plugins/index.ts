import https, { Agent } from 'https';
import fetch, { Response } from 'node-fetch';
import FormData from 'form-data';
import { inspect } from 'util';
import { EnvName } from '../support/types';

const formatLoggerData = (data: unknown) => {
  return inspect(data, {
    depth: 5,
    breakLength: Infinity,
    maxArrayLength: Infinity,
    maxStringLength: Infinity,
    compact: true
  });
};

module.exports = async (on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) => {
  on('task', {
    httpCall,
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
              'kbn-xsrf': 'true',
              Authorization: 'Basic ' + Buffer.from('kibana:kibana').toString('base64')
            }
          },
          res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
              try {
                const json = JSON.parse(data);
                console.log(
                  `Response: ${req.method} ${url}/api/status: HTTP STATUS ${res.statusCode}; Body: ${formatLoggerData(
                    json
                  )}`
                );
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
    }
  });

  config.env.envName = await getEnvironmentName(config);

  return config;
};

async function httpCall(options: HttpCallOptions): Promise<any> {
  const { method, url, headers, body, failOnStatusCode } = options;

  const agent: Agent = new Agent({
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method'
  });

  try {
    const response: Response = await fetch(url, { method, headers, body, agent });

    if (!response.ok && failOnStatusCode) {
      throw new Error(`HTTP error: ${method} ${url}: HTTP STATUS ${response.status}; Body: ${await response.text()}`);
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
}

async function getEnvironmentName(config: Cypress.PluginConfigOptions) {
  const response = await httpCall({
    url: config.env.elasticsearchUrl,
    method: 'GET',
    body: null,
    headers: { Authorization: 'Basic ' + Buffer.from(config.env.kibanaUserCredentials).toString('base64') }
  });

  return response.cluster_name === EnvName.ECK_ROR ? EnvName.ECK_ROR : EnvName.ELK_ROR;
}

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
