import semver from 'semver';
import { getKibanaVersion } from './index';

// Outside the range the test registers as pending. A version check inside the test body makes the
// report show a pass for a check that did not run.
export function itOnKibana(range: string, title: string, fn: Mocha.Func) {
  if (semver.satisfies(getKibanaVersion(), range)) {
    it(title, fn);
  } else {
    it.skip(title, fn);
  }
}
