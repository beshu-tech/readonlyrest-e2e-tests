import { BasicCredentials } from './KbnApiClient';

export const getKibanaVersion = () => {
  const kibanaVersion: string = Cypress.env('kibanaVersion');
  console.log('kibana version', kibanaVersion);
  if (!kibanaVersion) {
    throw new Error('Kibana version not specified in the config file');
  }

  return kibanaVersion;
};

export function requiredBaseUrl(): string {
  const baseUrl = Cypress.config('baseUrl');
  if (!baseUrl) throw new Error('Cypress baseUrl is not configured');
  return baseUrl;
}

export const userCredentials: BasicCredentials = `${Cypress.env().login}:${Cypress.env().password}`;

// Pastes the text into the element: one paste event, with no key events.
export function pasteText(element: HTMLElement, text: string) {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', text);
  element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
}
