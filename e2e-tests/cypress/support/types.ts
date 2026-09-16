export enum EnvName {
  'ECK_ROR' = 'eck-ror',
  'ELK_ROR' = 'elk-ror'
}
export const TENANCY_QUERY_STRING_KEY = 'tenancy';

/** The name a health probe reports when nothing in front of Kibana names a replica. */
export const SINGLE_REPLICA = 'kibana';

/** One health probe: what Kibana answered, and which replicas the proxy tried to get it. */
export type KibanaHealth = {
  status: string;
  /** Every replica the proxy tried, in order. More than one means a replica did not answer. */
  replicasTried: string[];
};
