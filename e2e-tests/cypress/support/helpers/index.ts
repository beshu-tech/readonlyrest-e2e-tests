export const getKibanaVersion = () => {
  const kibanaVersion: string = Cypress.env('kibanaVersion');
  console.log('kibana version', kibanaVersion);
  if (!kibanaVersion) {
    throw new Error('Kibana version not specified in the config file');
  }

  return kibanaVersion;
};

export function isJsonString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

export const userCredentials = `${Cypress.env().login}:${Cypress.env().password}`