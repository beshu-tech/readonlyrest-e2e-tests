import * as yaml from 'js-yaml';
import { kbnApiAdvancedClient } from './KbnApiAdvancedClient';
import { requiredBaseUrl } from './index';
import { Settings } from '../page-objects/Settings';

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

  /**
   * Puts the readonlyrest_kbn block of a kibana.yml fixture into the ROR settings index. The plugin
   * reads readonlyrest_kbn from the index, and the block in kibana.yml has no effect while the
   * index holds one.
   */
  static applyRorKbnSettings(fixture: string) {
    cy.fixture(fixture).then((kibanaYml: string) => {
      const { readonlyrest_kbn: rorKbnSettings } = yaml.load(kibanaYml) as { readonlyrest_kbn?: object };
      Settings.setReadonlyRestKbnSettings(rorKbnSettings ? yaml.dump(rorKbnSettings) : '');
    });
  }
}
