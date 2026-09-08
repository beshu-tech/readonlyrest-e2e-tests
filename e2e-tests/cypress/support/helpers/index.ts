import * as semver from 'semver';

export const getKibanaVersion = () => {
  const kibanaVersion: string = Cypress.env('kibanaVersion');
  console.log('kibana version', kibanaVersion);
  if (!kibanaVersion || !semver.valid(kibanaVersion)) {
    throw new Error(
      `Kibana version not specified correctly (got "${kibanaVersion}"). Pass it via --env kibanaVersion=<version>.`
    );
  }

  return kibanaVersion;
};

export function requiredBaseUrl(): string {
  const baseUrl = Cypress.config('baseUrl');
  if (!baseUrl) throw new Error('Cypress baseUrl is not configured');
  return baseUrl;
}

export function isJsonString(str: string) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

export const userCredentials = `${Cypress.env().login}:${Cypress.env().password}`;
