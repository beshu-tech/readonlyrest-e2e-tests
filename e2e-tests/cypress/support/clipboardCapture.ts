/**
 * Records what the application under test copies, without depending on the OS clipboard.
 *
 * Chromium 138 (the Electron bundled with Cypress 15) requires transient user activation for both
 * `navigator.clipboard.writeText()` and `document.execCommand('copy')`, and a Cypress-synthesized
 * click provides none. So Kibana's copy buttons no longer reach the real clipboard and
 * `readText()` resolves to an empty string. Both copy paths are therefore intercepted here, and
 * `cy.getValueFromClipboard()` reads what was captured.
 *
 * Kibana's share panel copies through EUI's `copyToClipboard`, which never calls `writeText`: it
 * stages the text in a hidden element, selects it, and calls `execCommand('copy')`. When Chromium
 * suppresses that command it also stops dispatching the `copy` event — and that event is where
 * ROR's own ClipboardInterception (proxy/preKibanaProxy/injection/scripts/tenancyContext) appends
 * the tenancy parameter. Simply reading the staged selection would therefore bypass the very
 * feature the tenancy specs assert on, so a synthetic copy event is dispatched instead: it bubbles
 * through ROR's genuine handler, which enriches onto it, and the enriched value is what we record.
 */

/**
 * Holds the text most recently copied by the application under test.
 *
 * Exported as a live object rather than a value on purpose: `cy.wrap(capture).its('text')` re-reads
 * the property on every retry, so an assertion still passes when the copy lands a moment after the
 * command was queued. Wrapping a plain string would freeze it at queue time.
 */
export const capture = { text: '' };

/** A test must never pass on a value some earlier test copied. */
export const resetClipboardCapture = (): void => {
  capture.text = '';
};

/** Records every `navigator.clipboard.writeText`, whether or not the real write is permitted. */
const wrapWriteText = (win: Cypress.AUTWindow): void => {
  const { clipboard } = win.navigator;
  const originalWriteText = clipboard.writeText.bind(clipboard);

  clipboard.writeText = (text: string) => {
    capture.text = String(text);
    return originalWriteText(text).catch(() => undefined);
  };
};

/** The text an `execCommand('copy')` would have put on the clipboard, had it been permitted. */
const stagedSelection = (win: Cypress.AUTWindow): string => {
  const active = win.document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  const isTextEntry = active !== null && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT');
  const inputSelection = isTextEntry
    ? (active.value ?? '').substring(active.selectionStart ?? 0, active.selectionEnd ?? active.value.length)
    : '';

  return inputSelection || (win.getSelection()?.toString() ?? '');
};

/** Runs the page's own `copy` handlers, and returns whatever they wrote to the event. */
const enrichedByPageHandlers = (win: Cypress.AUTWindow): string => {
  const dataTransfer = new win.DataTransfer();
  const syntheticCopy = new win.ClipboardEvent('copy', { clipboardData: dataTransfer, bubbles: true, cancelable: true });

  (win.document.activeElement ?? win.document).dispatchEvent(syntheticCopy);

  return dataTransfer.getData('text/plain');
};

/** Records every `execCommand('copy')`, preferring what the page's own handlers produced. */
const wrapExecCommandCopy = (win: Cypress.AUTWindow): void => {
  const doc = win.document;
  const originalExecCommand = doc.execCommand.bind(doc);

  doc.execCommand = (commandId: string, showUI?: boolean, value?: string) => {
    const result = originalExecCommand(commandId, showUI, value);

    if (commandId === 'copy') {
      const copied = enrichedByPageHandlers(win) || stagedSelection(win);
      if (copied) {
        capture.text = copied;
      }
    }

    return result;
  };
};

export const installClipboardCapture = (win: Cypress.AUTWindow): void => {
  wrapWriteText(win);
  wrapExecCommandCopy(win);
};
