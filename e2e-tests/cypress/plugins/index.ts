import { Agent } from 'https';
import fetch, { RequestInit, Response } from 'node-fetch';
import FormData from 'form-data';

module.exports = (on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) => {
  on('task', {
    async httpCall(options: HttpCallOptions): Promise<any> {
      const { method, url, headers, body } = options;

      const agent: Agent = new Agent({
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method',
      });

      try {
        const response: Response = await fetch(url, {
          method,
          headers: headers,
          body: body,
          agent,
        } as RequestInit);

        if (!response.ok) {
          throw new Error(`HTTP error: ${method} ${url}: HTTP STATUS ${response.status}; Body: ${await response.text()}`) 
        }

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
          ? await response.json()
          : await response.text();

        console.log(`Response: ${method} ${url}: HTTP STATUS ${response.status}; Body: ${data}`)  // todo: do we need that?
        return data;
      } catch (error) {
        console.error('HTTP Request failed:', {
          error: (error as Error).message,
          url,
          method,
          headers,
          body,
        });
        throw error;
      }
    },
    async uploadFile(options: UploadFileOptions): Promise<any> {
      const { url, headers, file } = options;

      const agent: Agent = new Agent({
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method',
      });

      const form = new FormData();
      form.append('file', file.fileBinaryContent, {
        filename: file.fileName,
        contentType: 'application/octet-stream'
      });

      const combinedHeaders: { [key: string]: string } = {
        ...headers,
        ...form.getHeaders(),
      };

      try {
        const response: Response = await fetch(url, {
          method: 'POST',
          headers: combinedHeaders,
          body: form,
          agent
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status} | URL: ${url} | Body: ${await response.text()}`);
        }

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
          ? await response.json()
          : await response.text();

        console.log('HTTP Request successful. Response data:', data); // todo: do we need that?
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
  });
};

interface HttpCallOptions {
  method: string;
  url: string;
  headers?: { [key: string]: string };
  body: string | object | null;
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
