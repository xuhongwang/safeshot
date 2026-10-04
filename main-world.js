(() => {
  'use strict';

  if (window.__safeshotMW) return;
  window.__safeshotMW = true;

  const ERR_TEXT = {
    zh: { missingImage: '缺少图片数据', emptyBlob: '图片数据为空' },
    en: { missingImage: 'Missing image data', emptyBlob: 'Image data is empty' }
  };

  function currentLang() {
    try {
      const value = document.documentElement.getAttribute('data-safeshot-lang');
      if (value === 'zh' || value === 'en') return value;
    } catch (e) {}
    try {
      return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function errText(key) {
    const dict = ERR_TEXT[currentLang()] || ERR_TEXT.en;
    return dict[key] || ERR_TEXT.en[key];
  }

  let resolveBlob = null;
  let rejectBlob = null;

  function setStatus(state) {
    document.documentElement.setAttribute('data-safeshot-clip', state);
  }

  function clearPending() {
    resolveBlob = null;
    rejectBlob = null;
  }

  function dataUrlToBlob(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  }

  function report(ok, error) {
    document.documentElement.setAttribute('data-safeshot-result', ok ? 'ok' : ('err:' + (error || 'unknown')));
    document.dispatchEvent(new CustomEvent('safeshot-clip-status'));
  }

  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#safeshot-confirm');
    if (!btn) return;

    document.documentElement.removeAttribute('data-safeshot-result');
    setStatus('checking');

    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      setStatus('unsupported');
      return;
    }

    if (rejectBlob) {
      try { rejectBlob(new Error('replaced')); } catch (_) {}
    }
    clearPending();

    let res, rej;
    const blobPromise = new Promise((resolve, reject) => {
      res = resolve;
      rej = reject;
    });
    resolveBlob = res;
    rejectBlob = rej;

    try {
      const item = new ClipboardItem({ 'image/png': blobPromise });
      const writePromise = navigator.clipboard.write([item]);
      setStatus('pending');

      writePromise.then(() => {
        setStatus('done');
        report(true);
        clearPending();
      }).catch((err) => {
        setStatus('error');
        report(false, err && err.message ? err.message : String(err));
        clearPending();
      });
    } catch (err) {
      setStatus('error');
      report(false, err && err.message ? err.message : String(err));
      clearPending();
    }
  }, true);

  document.addEventListener('safeshot-final-image', () => {
    if (!resolveBlob) return;
    const dataUrl = document.documentElement.getAttribute('data-safeshot-image');
    const resolve = resolveBlob;
    clearPending();

    try {
      if (!dataUrl) throw new Error(errText('missingImage'));
      const blob = dataUrlToBlob(dataUrl);
      if (!blob || blob.size === 0) throw new Error(errText('emptyBlob'));
      resolve(blob);
    } catch (err) {
      setStatus('error');
      report(false, err && err.message ? err.message : String(err));
    }
  });

  document.addEventListener('safeshot-clip-cancel', () => {
    if (rejectBlob) {
      const rej = rejectBlob;
      clearPending();
      try { rej(new Error('canceled')); } catch (_) {}
    }
    setStatus('canceled');
  });
})();
