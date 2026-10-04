'use strict';

const t = SafeShotI18n.t;

try {
  Object.defineProperty(document, 'hasFocus', { value: function () { return true; }, configurable: true });
} catch (e) {}

document.addEventListener('DOMContentLoaded', function () {
  document.body.setAttribute('tabindex', '-1');
  try { document.body.focus(); } catch (e) {}
  try { window.focus(); } catch (e) {}
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== 'offscreen-copy') return;

  (async () => {
    try {
      await SafeShotI18n.init();

      document.body.setAttribute('tabindex', '-1');
      try { document.body.focus(); } catch (e) {}
      try { window.focus(); } catch (e) {}

      let blob;
      try {
        const resp = await fetch(msg.dataUrl);
        blob = await resp.blob();
      } catch (e) {
        const base64 = msg.dataUrl.split(',')[1];
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], { type: 'image/png' });
      }

      if (!blob || blob.size === 0) throw new Error(t('err.emptyBlob'));

      let lastErr;
      for (let i = 0; i < 5; i++) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          await new Promise(r => setTimeout(r, 300));
          chrome.runtime.sendMessage({ type: 'offscreen-result', ok: true });
          sendResponse({ ok: true });
          return;
        } catch (e) {
          lastErr = e;
          try { document.body.focus(); } catch (e2) {}
          await new Promise(r => setTimeout(r, 300));
        }
      }
      throw lastErr;
    } catch (e) {
      const errText = e && e.message ? e.message : String(e);
      chrome.runtime.sendMessage({ type: 'offscreen-result', ok: false, error: errText });
      sendResponse({ ok: false, error: errText });
    }
  })();

  return true;
});
