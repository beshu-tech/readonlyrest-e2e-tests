// The accounts of the ReadonlyREST settings in fixtures/. The Cypress config holds the admin and
// kibana pairs. Each numbered user has the password dev.
export type BasicCredentials = `${string}:${string}`;

export const admin: BasicCredentials = `${Cypress.env().login}:${Cypress.env().password}`;
export const kibana: BasicCredentials = Cypress.env().kibanaUserCredentials;
export const user = (n: number): BasicCredentials => `user${n}:dev`;

// CI keeps its logs, so a message names the account and never the pair.
export const accountOf = (credentials: string): string => credentials.split(':')[0];
