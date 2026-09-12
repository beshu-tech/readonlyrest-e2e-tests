// The same values that cypress.config.ts puts in `env`, so the two suites talk to one stack.
// Each one takes an environment variable, which is what a developer needs to point the suite at a
// stack on other ports.

const stripTrailingSlash = url => url.replace(/\/+$/, '');

const milliseconds = (variableName, fallback) => {
  const raw = process.env[variableName];
  if (raw === undefined || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${variableName} must be a positive number of milliseconds, got: ${raw}`);
  }

  return value;
};

export const kibanaUrl = stripTrailingSlash(process.env.KIBANA_URL || 'https://localhost:5601');

export const elasticsearchUrl = stripTrailingSlash(process.env.ELASTICSEARCH_URL || 'https://localhost:9200');

export const userCredentials = `${process.env.KIBANA_LOGIN || 'admin'}:${process.env.KIBANA_PASSWORD || 'dev'}`;

// The account that may write the ROR settings index.
export const kibanaUserCredentials = process.env.KIBANA_USER_CREDENTIALS || 'kibana:kibana';

// 'elk-ror' or 'eck-ror'. runner.sh passes it down; it only names the environment in a failure.
export const envName = process.env.ENV_NAME || 'unknown';

/**
 * The deadline on every single request. undici waits 300s for the response headers and then
 * 300s more for the body, which is how one unreachable stack turned 15 tests into 65 minutes of
 * a CI leg. Cypress bounded the same calls at 20s (cypress.config.ts responseTimeout, taskTimeout);
 * this is larger only because a settings rewrite makes ReadonlyREST reload the whole ACL.
 */
export const requestTimeoutMs = milliseconds('HTTP_REQUEST_TIMEOUT_MS', 30000);

// The budget for the readiness check that runs once, before the tests.
export const readinessTimeoutMs = milliseconds('HTTP_READINESS_TIMEOUT_MS', 180000);

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
