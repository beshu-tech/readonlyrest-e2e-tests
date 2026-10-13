// The accounts of the ReadonlyREST settings in fixtures/. The Cypress config holds the admin and
// kibana pairs. Each numbered user has the password dev.
export type BasicCredentials = `${string}:${string}`;

export const adminCredentials: BasicCredentials = `${Cypress.env().login}:${Cypress.env().password}`;
export const kibanaCredentials: BasicCredentials = Cypress.env().kibanaUserCredentials;
export const user1Credentials: BasicCredentials = 'user1:dev';
export const user2Credentials: BasicCredentials = 'user2:dev';
export const user3Credentials: BasicCredentials = 'user3:dev';
export const user4Credentials: BasicCredentials = 'user4:dev';

// CI keeps its logs, so a message names the account and never the pair.
export const accountOf = (credentials: string): string => credentials.split(':')[0];
