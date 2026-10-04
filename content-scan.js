(() => {
  'use strict';

  if (window.__safeShotContentLoaded) return;
  window.__safeShotContentLoaded = true;

  const t = SafeShotI18n.t;

  const masks = [];
  const MASK_DEFAULTS = { mode: 'mosaic', block: 12, color: '#000000' };
  let maskStyle = Object.assign({}, MASK_DEFAULTS);

  async function loadMaskStyle() {
    try {
      const data = await chrome.storage.local.get(['maskStyle']);
      if (data.maskStyle) maskStyle = Object.assign({}, MASK_DEFAULTS, data.maskStyle);
    } catch (e) {}
    return maskStyle;
  }

  function previewStyleFor(isText) {
    if (maskStyle.mode === 'color') {
      return 'background:' + maskStyle.color + ';' + (isText ? 'color:' + maskStyle.color + ';' : '');
    }
    return 'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
      'background:rgba(255,255,255,0.12);' +
      (isText ? 'color:transparent;display:inline-block;vertical-align:middle;' : '');
  }

  // ============ 遮罩创建 ============

  function maskElement(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const mask = document.createElement('div');
    mask.className = 'safeshot-mask';
    mask.style.cssText =
      'position:fixed;z-index:2147483647;left:' + rect.left + 'px;' +
      'top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height +
      'px;pointer-events:none;' + previewStyleFor(false);
    document.documentElement.appendChild(mask);
    return { type: 'div', mask: mask, el: el, rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height } };
  }

  function maskTextNode(node, regexItems) {
    const text = node.nodeValue;
    if (!text || !text.trim()) return;

    let intervals = [];
    for (const item of regexItems) {
      const re = new RegExp(item.rule.pattern, (item.rule.flags || 'g').replace(/g/g, '') + 'g');
      let m;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; break; }
        intervals.push({ start: m.index, end: m.index + m[0].length });
      }
    }
    if (intervals.length === 0) return;

    intervals.sort(function (a, b) { return a.start - b.start; });
    const merged = [];
    for (const iv of intervals) {
      if (merged.length && iv.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, iv.end);
      } else {
        merged.push({ start: iv.start, end: iv.end });
      }
    }

    const parent = node.parentNode;
    const startMarker = document.createElement('span');
    const endMarker = document.createElement('span');
    startMarker.className = 'safeshot-restore-marker';
    endMarker.className = 'safeshot-restore-marker';
    startMarker.style.display = 'none';
    endMarker.style.display = 'none';

    parent.insertBefore(startMarker, node);
    if (node.nextSibling) {
      parent.insertBefore(endMarker, node.nextSibling);
    } else {
      parent.appendChild(endMarker);
    }

    const frag = document.createDocumentFragment();
    let last = 0;
    const textRects = [];
    for (const iv of merged) {
      if (iv.start > last) frag.appendChild(document.createTextNode(text.slice(last, iv.start)));
      const span = document.createElement('span');
      span.className = 'safeshot-mask-text';
      span.style.cssText = previewStyleFor(true);
      span.textContent = text.slice(iv.start, iv.end);
      frag.appendChild(span);
      textRects.push(span);
      last = iv.end;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

    parent.replaceChild(frag, node);
    masks.push({ type: 'text', parent: parent, original: node, startMarker: startMarker, endMarker: endMarker, textRects: textRects });
  }

  // ============ 扫描与恢复 ============

  async function scan() {
    restore();
    await loadMaskStyle();
    document.documentElement.removeAttribute('data-safeshot-clip');
    document.documentElement.removeAttribute('data-safeshot-result');
    document.documentElement.removeAttribute('data-safeshot-image');

    const rules = await SafeShotRules.getEnabledRules();
    const inputRules = rules.filter(function (r) { return r.type === 'input'; });
    const regexRules = rules.filter(function (r) { return r.type === 'regex'; })
      .map(function (r) { return { rule: r }; });

    for (const rule of inputRules) {
      let inputs = [];
      try { inputs = document.querySelectorAll(rule.selector); } catch (e) { inputs = []; }
      inputs.forEach(function (el) {
        if (el.closest && el.closest('.safeshot-mask')) return;
        const m = maskElement(el);
        if (m) masks.push(m);
      });
    }

    const walker = document.createTreeWalker(
      document.body || document.documentElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (parent && parent.closest && parent.closest('.safeshot-mask-text')) return NodeFilter.FILTER_REJECT;
          const tag = (parent && parent.tagName || '').toLowerCase();
          if (['script', 'style', 'noscript', 'textarea'].indexOf(tag) >= 0) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let n;
    while ((n = walker.nextNode())) {
      maskTextNode(n, regexRules);
    }

    return masks.length;
  }

  function restore() {
    for (let i = masks.length - 1; i >= 0; i--) {
      const item = masks[i];
      if (item.type === 'div') {
        if (item.mask && item.mask.parentNode) item.mask.parentNode.removeChild(item.mask);
      } else if (item.type === 'text') {
        const parent = item.parent;
        if (!parent) continue;
        const sm = item.startMarker;
        const em = item.endMarker;
        if (!sm || !sm.parentNode || !em || !em.parentNode) continue;

        const toRemove = [];
        let cur = sm.nextSibling;
        while (cur && cur !== em) {
          toRemove.push(cur);
          cur = cur.nextSibling;
        }
        toRemove.forEach(function (node) { parent.removeChild(node); });
        parent.insertBefore(item.original, em);
        if (sm.parentNode) sm.parentNode.removeChild(sm);
        if (em.parentNode) em.parentNode.removeChild(em);
      }
    }
    masks.length = 0;
  }

  // ============ Overlay 交互层 ============

  function getAutoMasksRects() {
    const rects = [];
    for (const item of masks) {
      if (item.type === 'div' && item.rect) {
        rects.push({ x: item.rect.x, y: item.rect.y, w: item.rect.w, h: item.rect.h });
      } else if (item.type === 'text' && item.textRects) {
        for (const span of item.textRects) {
          const r = span.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            rects.push({ x: r.left, y: r.top, w: r.width, h: r.height });
          }
        }
      }
    }
    return rects;
  }

  function createOverlay(autoMasks, sendResponseCallback) {
    destroyOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'safeshot-overlay';
    overlay.style.cssText = `
      position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483646;
      background:rgba(0,0,0,0.15);cursor:crosshair;font-family:system-ui,sans-serif;
    `;

    const toolbar = document.createElement('div');
    toolbar.id = 'safeshot-toolbar';
    toolbar.style.cssText = `
      position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;
      display:flex;align-items:center;gap:10px;padding:8px 16px;
      background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);
      font-size:13px;color:#374151;user-select:none;
    `;
    toolbar.innerHTML = `
      <span style="color:#6b7280;">${t('ui.toolbarHint')}</span>
      <span style="color:#9ca3af;font-size:11px;">${t('ui.keyHint')}</span>
      <button id="safeshot-cancel" style="
        padding:5px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;
        font-size:12px;cursor:pointer;color:#374151;
      ">${t('ui.cancel')}</button>
      <button id="safeshot-confirm" style="
        padding:5px 12px;border:1px solid #2563eb;border-radius:6px;background:#2563eb;
        font-size:12px;cursor:pointer;color:#fff;font-weight:600;
      ">${t('ui.confirmCapture')}</button>
    `;

    overlay.appendChild(toolbar);
    document.documentElement.appendChild(overlay);

    const userMasks = [];
    let isDrawing = false;
    let drawStart = null;
    let previewRect = null;

    function redrawOverlayMasks() {
      overlay.querySelectorAll('.safeshot-overlay-mask').forEach(el => el.remove());
      const all = autoMasks.concat(userMasks);
      all.forEach((m, i) => {
        const div = document.createElement('div');
        div.className = 'safeshot-overlay-mask';
        div.dataset.index = i;
        div.style.cssText = `
          position:fixed;left:${m.x}px;top:${m.y}px;width:${m.w}px;height:${m.h}px;
          z-index:2147483647;cursor:pointer;
        ` + previewStyleFor(false);
        div.title = i >= autoMasks.length ? t('mask.deleteThis') : t('mask.auto');
        overlay.appendChild(div);
      });
    }

    redrawOverlayMasks();

    overlay.addEventListener('mousedown', (e) => {
      if (e.target.id === 'safeshot-cancel' || e.target.id === 'safeshot-confirm') return;
      if (e.target.classList.contains('safeshot-overlay-mask')) return;
      isDrawing = true;
      drawStart = { x: e.clientX, y: e.clientY };
      previewRect = document.createElement('div');
      previewRect.style.cssText = `
        position:fixed;border:2px dashed #2563eb;background:rgba(37,99,235,0.1);
        pointer-events:none;z-index:2147483647;
      `;
      overlay.appendChild(previewRect);
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!isDrawing || !previewRect) return;
      const x = Math.min(drawStart.x, e.clientX);
      const y = Math.min(drawStart.y, e.clientY);
      const w = Math.abs(e.clientX - drawStart.x);
      const h = Math.abs(e.clientY - drawStart.y);
      previewRect.style.left = x + 'px';
      previewRect.style.top = y + 'px';
      previewRect.style.width = w + 'px';
      previewRect.style.height = h + 'px';
    });

    overlay.addEventListener('mouseup', (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      if (previewRect) {
        previewRect.remove();
        previewRect = null;
      }
      const x = Math.min(drawStart.x, e.clientX);
      const y = Math.min(drawStart.y, e.clientY);
      const w = Math.abs(e.clientX - drawStart.x);
      const h = Math.abs(e.clientY - drawStart.y);
      if (w > 4 && h > 4) {
        userMasks.push({ x, y, w, h });
        redrawOverlayMasks();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('safeshot-overlay-mask')) {
        const idx = parseInt(e.target.dataset.index, 10);
        if (idx >= autoMasks.length) {
          userMasks.splice(idx - autoMasks.length, 1);
          redrawOverlayMasks();
        }
      }
    });

    function confirmOverlay() {
      document.removeEventListener('keydown', onKeydown);
      const allMasks = autoMasks.concat(userMasks);
      const clipState = document.documentElement.getAttribute('data-safeshot-clip');
      const hasMW = !!window.__safeshotMW;
      destroyOverlay();
      restore();
      if (clipState === 'unsupported') {
        try {
          ensureClipIframe();
          focusClipIframe();
        } catch (_) {}
      }
      try {
        sendResponseCallback({
          canceled: false,
          masks: allMasks,
          clipMode: clipState === 'pending' || clipState === 'checking' ? 'clipboard' : (clipState === 'unsupported' ? 'exec' : 'offscreen'),
          clipState: clipState || 'null',
          hasMW: hasMW
        });
      } catch (e) {}
    }

    document.getElementById('safeshot-cancel').addEventListener('click', () => {
      document.removeEventListener('keydown', onKeydown);
      document.dispatchEvent(new CustomEvent('safeshot-clip-cancel'));
      destroyOverlay();
      restore();
      try { sendResponseCallback({ canceled: true }); } catch (e) {}
    });

    document.getElementById('safeshot-confirm').addEventListener('click', confirmOverlay);

    function onKeydown(e) {
      if (e.key === 'Enter') {
        if (e.target && e.target.closest && e.target.closest('button')) return;
        e.preventDefault();
        // 走按钮 click 路径，确保 MAIN world 的剪贴板监听被触发
        const btn = document.getElementById('safeshot-confirm');
        if (btn) btn.click();
        else confirmOverlay();
      } else if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKeydown);
        document.dispatchEvent(new CustomEvent('safeshot-clip-cancel'));
        destroyOverlay();
        restore();
        try { sendResponseCallback({ canceled: true }); } catch (e) {}
      }
    }
    document.addEventListener('keydown', onKeydown);
  }

  function destroyOverlay() {
    const el = document.getElementById('safeshot-overlay');
    if (el) el.remove();
  }

  // ============ 复制图片到剪贴板 ============

  let clipIframe = null;
  let pendingClip = null;
  let clipMsgBound = false;

  function focusClipIframe() {
    if (!clipIframe) return;
    try { clipIframe.focus(); } catch (_) {}
    try { clipIframe.contentWindow.focus(); } catch (_) {}
  }

  function bindClipMessages() {
    if (clipMsgBound) return;
    clipMsgBound = true;
    window.addEventListener('message', function (e) {
      if (!clipIframe || e.source !== clipIframe.contentWindow) return;
      const d = e.data;
      if (!d) return;
      if (d.safeshotClipReady && pendingClip && !pendingClip.sent) {
        pendingClip.sent = true;
        focusClipIframe();
        try { clipIframe.contentWindow.postMessage({ safeshotDataUrl: pendingClip.dataUrl }, '*'); } catch (_) {}
      } else if (d.safeshotClipResult && pendingClip) {
        const p = pendingClip;
        pendingClip = null;
        clearTimeout(p.timer);
        if (d.safeshotClipResult.ok) p.resolve();
        else p.reject(new Error(d.safeshotClipResult.error || t('err.iframeCopyFailed')));
      }
    });
  }

  function ensureClipIframe() {
    bindClipMessages();
    if (clipIframe && clipIframe.isConnected) return clipIframe;
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('clip.html');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.allow = 'clipboard-write';
    iframe.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;border:0;opacity:0.01;' +
      'z-index:2147483647;';
    document.documentElement.appendChild(iframe);
    clipIframe = iframe;
    return iframe;
  }

  function copyViaIframe(dataUrl) {
    return new Promise(function (resolve, reject) {
      const iframe = ensureClipIframe();

      if (pendingClip) {
        const old = pendingClip;
        pendingClip = null;
        clearTimeout(old.timer);
        old.reject(new Error('replaced'));
      }

      const p = { dataUrl: dataUrl, resolve: resolve, reject: reject, sent: false, timer: null };
      p.timer = setTimeout(function () {
        if (pendingClip === p) {
          pendingClip = null;
          reject(new Error(t('err.iframeCopyTimeout')));
        }
      }, 8000);
      pendingClip = p;

      focusClipIframe();
      try { iframe.contentWindow.postMessage({ safeshotDataUrl: dataUrl }, '*'); } catch (_) {}

      setTimeout(function () {
        if (pendingClip === p && !p.sent) {
          p.sent = true;
          focusClipIframe();
          try { iframe.contentWindow.postMessage({ safeshotDataUrl: dataUrl }, '*'); } catch (_) {}
        }
      }, 300);
    });
  }

  function copyViaBestEffort(dataUrl) {
    return copyViaIframe(dataUrl).catch(function (iframeErr) {
      return copyViaExecCommand(dataUrl).catch(function (execErr) {
        throw new Error(t('err.bestEffort', {
          a: (iframeErr && iframeErr.message || iframeErr),
          b: (execErr && execErr.message || execErr)
        }));
      });
    });
  }

  function copyViaExecCommand(dataUrl) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () {
        try {
          const holder = document.createElement('div');
          holder.contentEditable = 'true';
          holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + img.width + 'px;height:' + img.height + 'px;';
          holder.appendChild(img);
          document.body.appendChild(holder);

          const range = document.createRange();
          range.selectNode(img);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);

          const ok = document.execCommand('copy');
          sel.removeAllRanges();
          holder.remove();

          if (ok) resolve(true);
          else reject(new Error(t('err.execFalse')));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = function () { reject(new Error(t('err.imgLoadFailed'))); };
      img.src = dataUrl;
    });
  }

  async function prepareFinalImage(dataUrl, rectList) {
    restore();
    await loadMaskStyle();

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    if (rectList && rectList.length > 0) {
      const scaleX = canvas.width / window.innerWidth;
      const scaleY = canvas.height / window.innerHeight;

      rectList.forEach(m => {
        let x = Math.round(m.x * scaleX);
        let y = Math.round(m.y * scaleY);
        let w = Math.round(m.w * scaleX);
        let h = Math.round(m.h * scaleY);
        if (x < 0) { w += x; x = 0; }
        if (y < 0) { h += y; y = 0; }
        if (x + w > canvas.width) w = canvas.width - x;
        if (y + h > canvas.height) h = canvas.height - y;
        if (w <= 0 || h <= 0) return;

        if (maskStyle.mode === 'color') {
          ctx.fillStyle = maskStyle.color;
          ctx.fillRect(x, y, w, h);
        } else {
          const block = Math.max(2, maskStyle.block || 12);
          const sw = Math.max(1, Math.round(w / block));
          const sh = Math.max(1, Math.round(h / block));
          const tmp = document.createElement('canvas');
          tmp.width = sw;
          tmp.height = sh;
          const tc = tmp.getContext('2d');
          tc.drawImage(img, x, y, w, h, 0, 0, sw, sh);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tmp, 0, 0, sw, sh, x, y, w, h);
          ctx.imageSmoothingEnabled = true;
        }
      });
    }

    img.src = '';
    return canvas.toDataURL('image/png');
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483647;
      background:#111827;color:#fff;padding:10px 20px;border-radius:8px;
      font-size:14px;box-shadow:0 2px 12px rgba(0,0,0,0.3);
      font-family:system-ui,sans-serif;
    `;
    document.documentElement.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  // ============ 消息监听 ============

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === 'scan') {
      scan().then(function (count) {
        sendResponse({ ok: true, count: count });
      }).catch(function (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      });
      return true;
    } else if (msg.type === 'restore') {
      try {
        restore();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    } else if (msg.type === 'show-overlay') {
      SafeShotI18n.init().then(function () {
        const autoMasks = getAutoMasksRects();
        createOverlay(autoMasks, sendResponse);
      });
      return true;
    } else if (msg.type === 'prepare-image') {
      prepareFinalImage(msg.dataUrl, msg.masks || []).then(function (finalDataUrl) {
        sendResponse({ ok: true, dataUrl: finalDataUrl });
      }).catch(function (err) {
        sendResponse({ ok: false, error: String(err) });
      });
      msg.dataUrl = null;
      return true;
    } else if (msg.type === 'deliver-image') {
      if (msg.mode === 'exec') {
        copyViaBestEffort(msg.dataUrl).then(function () {
          sendResponse({ ok: true });
        }).catch(function (err) {
          sendResponse({ ok: false, error: String(err && err.message || err) });
        });
        return true;
      }

      const clipState = document.documentElement.getAttribute('data-safeshot-clip');
      const resultAttr = document.documentElement.getAttribute('data-safeshot-result');

      if (resultAttr === 'ok') {
        sendResponse({ ok: true });
        return;
      }
      if (resultAttr && resultAttr.indexOf('err:') === 0) {
        sendResponse({ ok: false, error: resultAttr.slice(4) });
        return;
      }
      if (clipState === 'unsupported') {
        sendResponse({ ok: false, error: t('err.notSecureContext') });
        return;
      }
      if (clipState === 'error' || clipState === 'canceled') {
        sendResponse({ ok: false, error: clipState });
        return;
      }

      document.documentElement.setAttribute('data-safeshot-image', msg.dataUrl);

      const timer = setTimeout(function () {
        cleanup();
        sendResponse({ ok: false, error: t('err.clipTimeout') });
      }, 8000);

      function onStatus() {
        cleanup();
        const res = document.documentElement.getAttribute('data-safeshot-result');
        if (res === 'ok') sendResponse({ ok: true });
        else if (res && res.indexOf('err:') === 0) sendResponse({ ok: false, error: res.slice(4) });
        else sendResponse({ ok: false, error: t('err.unknown') });
      }

      function cleanup() {
        clearTimeout(timer);
        document.removeEventListener('safeshot-clip-status', onStatus);
        try { document.documentElement.removeAttribute('data-safeshot-image'); } catch (_) {}
      }

      document.addEventListener('safeshot-clip-status', onStatus);
      document.dispatchEvent(new CustomEvent('safeshot-final-image'));
      return true;
    } else if (msg.type === 'clear-image') {
      try { document.documentElement.removeAttribute('data-safeshot-image'); } catch (_) {}
      sendResponse({ ok: true });
    } else if (msg.type === 'copy-image') {
      copyViaBestEffort(msg.dataUrl).then(function () {
        sendResponse({ ok: true });
      }).catch(function (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      });
      return true;
    } else if (msg.type === 'show-toast') {
      showToast(msg.text || '');
      sendResponse({ ok: true });
    }
  });
})();
