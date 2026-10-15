import { kbnApiAdvancedClient } from './KbnApiAdvancedClient';
import { requiredBaseUrl } from './index';

// Longer than the wait in set-kibana-config.sh, so the script reports its own timeout.
const RESTART_TIMEOUT_MS = 10 * 60 * 1000;

export class KibanaConfig {
  /**
   * Restarts every Kibana replica with the fixture as kibana.yml, or with the kibana.yml of the
   * environment when no fixture is given. Docker environment only.
   */
  static apply(fixture?: string) {
    cy.task('setKibanaConfig', { fixture: fixture ?? null }, { timeout: RESTART_TIMEOUT_MS });
    kbnApiAdvancedClient.waitForKibanaHealth(requiredBaseUrl());
  }
}
