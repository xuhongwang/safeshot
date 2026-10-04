'use strict';

const t = SafeShotI18n.t;

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

window.addEventListener('message', async function (e) {
  if (e.source !== window.parent) return;
  const dataUrl = e.data && e.data.safeshotDataUrl;
  if (!dataUrl) return;

  try {
    await SafeShotI18n.init();

    try { window.focus(); } catch (_) {}
    try { document.body.focus(); } catch (_) {}

    const blob = dataUrlToBlob(dataUrl);
    if (!blob || blob.size === 0) throw new Error(t('err.emptyBlob'));

    let lastErr = null;
    let ok = false;
    for (let i = 0; i < 6; i++) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        ok = true;
        break;
      } catch (err) {
        lastErr = err;
        try { window.focus(); } catch (_) {}
        try { document.body.focus(); } catch (_) {}
        await new Promise(r => setTimeout(r, 250));
      }
    }
    if (!ok) throw lastErr || new Error(t('err.writeFailed'));

    window.parent.postMessage({ safeshotClipResult: { ok: true } }, '*');
  } catch (err) {
    window.parent.postMessage({
      safeshotClipResult: { ok: false, error: err && err.message ? err.message : String(err) }
    }, '*');
  }
});

try { window.parent.postMessage({ safeshotClipReady: true }, '*'); } catch (_) {}
