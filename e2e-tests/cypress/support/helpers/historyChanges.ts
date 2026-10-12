// Diagnostics for a rare loop of the Maps list page (CI run 38213056923, Kibana 8.19 on ECK): the
// page stayed blank while the URL hash changed to #/ and back, and the cause is not known. This
// records each history change of the page with the stack that made it, and adds the record to the
// error message when the test fails, so the next failure names the code that writes the hash.
const MAX_ENTRIES = 200;
const ENTRIES_IN_ERROR = 60;

export function recordHistoryChanges(): void {
  const entries: string[] = [];
  const start = Date.now();
  const record = (kind: string, url: string) => {
    if (entries.length >= MAX_ENTRIES) return;
    // The history library frames come first; the frames after them name the code that navigates.
    const stack = (new Error().stack ?? '')
      .split('\n')
      .slice(2)
      .map(line => line.trim())
      .filter(line => !line.includes('kbn-ui-shared-deps-npm'))
      .slice(0, 6)
      .join(' < ');
    entries.push(`+${Date.now() - start} ms ${kind} ${url.replace(/tenancy=[^&#]*/, 'tenancy=…')} ${stack}`);
  };
  cy.window().then(win => {
    (['pushState', 'replaceState'] as const).forEach(method => {
      const original = win.history[method];
      win.history[method] = function (this: History, state: unknown, title: string, url?: string | URL | null) {
        record(method, String(url ?? ''));
        return original.call(this, state, title, url);
      };
    });
    win.addEventListener('hashchange', () => record('hashchange', win.location.href));
    win.addEventListener('popstate', () => record('popstate', win.location.href));
  });
  cy.on('fail', error => {
    error.message += `\n\nHistory changes (${entries.length}):\n${entries.slice(0, ENTRIES_IN_ERROR).join('\n')}`;
    throw error;
  });
}
