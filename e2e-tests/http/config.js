// The same values that cypress.config.ts puts in `env`, so the two suites talk to one stack.
// Each one takes an environment variable, which is what a developer needs to point the suite at a
// stack on other ports.

const stripTrailingSlash = url => url.replace(/\/+$/, '');

export const kibanaUrl = stripTrailingSlash(process.env.KIBANA_URL || 'https://localhost:5601');

export const elasticsearchUrl = stripTrailingSlash(process.env.ELASTICSEARCH_URL || 'https://localhost:9200');

export const userCredentials = `${process.env.KIBANA_LOGIN || 'admin'}:${process.env.KIBANA_PASSWORD || 'dev'}`;

// The account that may write the ROR settings index.
export const kibanaUserCredentials = process.env.KIBANA_USER_CREDENTIALS || 'kibana:kibana';

export function getKibanaVersion() {
  const kibanaVersion = process.env.KIBANA_VERSION;
  if (!kibanaVersion) {
    throw new Error('KIBANA_VERSION is not set. Start the suite with e2e-tests/http/run-tests.sh <kibana version>.');
  }

  return kibanaVersion;
}

/**
 * True when `version` is at least `minimum`. It reads the three numbers and ignores a prerelease
 * tag, so 9.0.0-beta1 counts as 9.0.0. The suite compares release lines only, which is all the
 * Cypress specs did with semver.gte, and this keeps the suite free of dependencies.
 */
export function versionGte(version, minimum) {
  const parts = value =>
    String(value)
      .split('-')[0]
      .split('.')
      .map(part => Number.parseInt(part, 10) || 0);

  const actual = parts(version);
  const expected = parts(minimum);

  for (let i = 0; i < 3; i++) {
    if ((actual[i] || 0) !== (expected[i] || 0)) return (actual[i] || 0) > (expected[i] || 0);
  }

  return true;
}
