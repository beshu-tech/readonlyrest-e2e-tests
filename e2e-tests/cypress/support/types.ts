export enum EnvName {
  'ECK_ROR' = 'eck-ror',
  'ELK_ROR' = 'elk-ror'
}
export const TENANCY_QUERY_STRING_KEY = 'tenancy';
export const X_ROR_TENANCY = 'x-ror-tenancy';

export interface HttpResponse<T = unknown> {
  status: number;
  headers: { [name: string]: string };
  body: T;
}
