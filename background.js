'use strict';

importScripts('i18n.js');

const t = SafeShotI18n.t;

let pendingCopy = null;

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get(['enabled', 'customRules', 'whitelist', 'maskStyle', 'lang'], function (data) {
    const toSet = {};
    if (typeof data.enabled === 'undefined') toSet.enabled = true;
    if (typeof data.customRules === 'undefined') toSet.customRules = [];
    if (typeof data.whitelist === 'undefined') toSet.whitelist = [];
    if (typeof data.lang === 'undefined') toSet.lang = 'auto';
    if (typeof data.maskStyle === 'undefined') {
      toSet.maskStyle = { mode: 'mosaic', block: 12, color: '#000000' };
    }
    if (Object.keys(toSet).length) chrome.storage.local.set(toSet);
  });

  chrome.contextMenus.create({
    id: 'safeshot-capture',
    title: t('menu.capture'),
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === 'safeshot-capture' && tab && tab.id) {
    runCommandFlow(tab.id);
  }
});

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== 'local' || !changes || !changes.lang) return;
  SafeShotI18n.setSetting(changes.lang.newValue);
  chrome.contextMenus.update('safeshot-capture', { title: t('menu.capture') }, function () {
    void chrome.runtime.lastError;
  });
  if (!badgeTimer) {
    chrome.action.setTitle({ title: t('badge.reset') }, function () {
      void chrome.runtime.lastError;
    });
  }
});

chrome.commands.onCommand.addListener(function (command, tab) {
  if (command !== 'start-capture') return;
  const tabId = tab && tab.id ? tab.id : null;
  if (tabId) { runCommandFlow(tabId); return; }
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0]) runCommandFlow(tabs[0].id);
  });
});

function runCommandFlow(tabId) {
  startCaptureFlow(tabId).catch(function (err) {
    showToast(tabId, t('toast.captureFailed') + (err && err.message ? err.message : err));
  });
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return;

  if (msg.type === 'start-capture') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) {
        sendResponse({ ok: false, error: t('err.noActiveTab') });
        return;
      }
      startCaptureFlow(tabs[0].id).then(function (result) {
        sendResponse(result);
      }).catch(function (err) {
        sendResponse({ ok: false, error: err && err.message ? err.message : String(err) });
      });
    });
    return true;
  }

  if (msg.type === 'offscreen-result' && pendingCopy) {
    const resolver = pendingCopy;
    pendingCopy = null;
    resolver(msg);
    sendResponse({ ok: true });
  }
});

async function startCaptureFlow(tabId) {
  const tab = await getTab(tabId);
  if (!tab) throw new Error(t('err.invalidTab'));
  if (isRestrictedUrl(tab.url)) throw new Error(t('err.restricted'));

  const settings = await chrome.storage.local.get(['enabled', 'whitelist']);
  const autoScan = settings.enabled !== false;

  const host = new URL(tab.url).hostname;
  const whitelist = settings.whitelist || [];
  const skipped = whitelist.indexOf(host) >= 0;

  await injectScripts(tabId);
  await injectMainWorld(tabId);

  if (skipped) {
    const dataUrl = await doCapture(tab);
    const clipResult = await sendToTab(tabId, { type: 'copy-image', dataUrl: dataUrl });
    if (clipResult && clipResult.ok) {
      await showToast(tabId, t('toast.copied'));
      return { ok: true, done: true, mode: 'clipboard' };
    }
    const clipErr = clipResult && clipResult.error ? clipResult.error : t('misc.notAttempted');
    const result = await saveImage(dataUrl);
    await showToast(tabId, result.mode === 'clipboard' ? t('toast.copied')
      : t('toast.downloadedDiag', { diag: t('diag.whitelist') + ' ' + clipErr }));
    return { ok: true, done: true, mode: result.mode, error: clipErr };
  }

  if (autoScan) {
    await sendToTab(tabId, { type: 'scan' });
  } else {
    // 未启用自动扫描：清理可能残留的自动遮罩，截图/手动打码照常
    await sendToTab(tabId, { type: 'restore' });
  }

  const overlayResult = await sendToTab(tabId, { type: 'show-overlay' });
  if (!overlayResult || overlayResult.canceled) {
    await sendToTab(tabId, { type: 'restore' }).catch(() => {});
    return { ok: false, canceled: true };
  }

  await sendToTab(tabId, { type: 'restore' }).catch(() => {});
  await new Promise(r => setTimeout(r, 100));

  let dataUrl = await doCapture(tab);

  const prepResult = await sendToTab(tabId, {
    type: 'prepare-image',
    dataUrl: dataUrl,
    masks: overlayResult.masks || []
  });
  dataUrl = null;

  if (!prepResult || !prepResult.ok) {
    await sendToTab(tabId, { type: 'restore' }).catch(() => {});
    throw new Error(prepResult ? prepResult.error : t('err.imageProcess'));
  }

  const finalDataUrl = prepResult.dataUrl;
  prepResult.dataUrl = null;

  if (overlayResult.clipMode === 'clipboard' || overlayResult.clipMode === 'exec') {
    try {
      const clipResult = await sendToTab(tabId, {
        type: 'deliver-image',
        dataUrl: finalDataUrl,
        mode: overlayResult.clipMode
      });
      if (clipResult && clipResult.ok) {
        await showToast(tabId, t('toast.copied'));
        return { ok: true, done: true, mode: 'clipboard' };
      }
      const clipErr = clipResult && clipResult.error ? clipResult.error : t('err.clipWriteFailed');
      await sendToTab(tabId, { type: 'clear-image' }).catch(() => {});
      const result = await saveImage(finalDataUrl);
      await showToast(tabId, result.mode === 'clipboard' ? t('toast.copied')
        : t('toast.downloadedDiag', { diag: 'mode=' + overlayResult.clipMode + ' ' + clipErr }));
      return { ok: true, done: true, mode: result.mode, error: clipErr };
    } catch (e) {
      await sendToTab(tabId, { type: 'clear-image' }).catch(() => {});
      const result = await saveImage(finalDataUrl);
      await showToast(tabId, result.mode === 'clipboard' ? t('toast.copied')
        : t('toast.downloadedDiag', { diag: 'mode=' + overlayResult.clipMode + ' ' + (e.message || e) }));
      return { ok: true, done: true, mode: result.mode, error: e.message || String(e) };
    }
  }

  const result = await saveImage(finalDataUrl);
  await showToast(tabId, result.mode === 'clipboard' ? t('toast.copied')
    : t('toast.downloadedDiag', {
        diag: 'mode=' + (overlayResult.clipMode || 'none') +
          ' st=' + (overlayResult.clipState || '?') +
          ' mw=' + overlayResult.hasMW + ' ' + result.error
      }));

  return { ok: true, done: true, mode: result.mode, error: result.error };
}

async function saveImage(dataUrl) {
  try {
    await copyViaOffscreen(dataUrl);
    return { mode: 'clipboard' };
  } catch (e) {
    const err = e && e.message ? e.message : String(e);
    try {
      await downloadDataUrl(dataUrl);
      return { mode: 'download', error: err };
    } catch (e2) {
      throw new Error(t('err.copyThenDownload', { a: err, b: e2.message || e2 }));
    }
  }
}

function copyViaOffscreen(dataUrl) {
  return new Promise(async function (resolve, reject) {
    try { await chrome.offscreen.closeDocument(); } catch (e) {}

    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Copy screenshot to clipboard'
    });
    await new Promise(r => setTimeout(r, 600));

    const timeout = setTimeout(function () {
      if (pendingCopy) {
        pendingCopy = null;
        reject(new Error(t('err.copyTimeout')));
      }
    }, 10000);

    pendingCopy = function (msg) {
      clearTimeout(timeout);
      if (msg.ok) resolve();
      else reject(new Error(msg.error || t('err.copyFailed')));
    };

    chrome.runtime.sendMessage({ type: 'offscreen-copy', dataUrl: dataUrl }, function () {
      if (chrome.runtime.lastError) {
        clearTimeout(timeout);
        pendingCopy = null;
        reject(new Error(chrome.runtime.lastError.message));
      }
    });
  });
}

function downloadDataUrl(dataUrl) {
  return new Promise(function (resolve, reject) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    chrome.downloads.download({
      url: dataUrl,
      filename: 'SafeShot-' + ts + '.png',
      saveAs: false
    }, function (id) {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(id);
    });
  });
}

let badgeTimer = null;

async function showToast(tabId, text) {
  const resp = await sendToTab(tabId, { type: 'show-toast', text: text });
  if (resp) return;
  // 页面不可达（受限页等无法注入 content script）→ 图标徽标兜底提示
  try {
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setTitle({ title: t('badge.titlePrefix') + text });
    if (badgeTimer) clearTimeout(badgeTimer);
    badgeTimer = setTimeout(function () {
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setTitle({ title: t('badge.reset') });
      badgeTimer = null;
    }, 3000);
  } catch (e) { /* 忽略 */ }
}

function getTab(tabId) {
  return new Promise(function (resolve) {
    chrome.tabs.get(tabId, function (tab) {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(tab);
    });
  });
}

function injectScripts(tabId) {
  return new Promise(function (resolve, reject) {
    chrome.scripting.executeScript(
      { target: { tabId: tabId }, files: ['i18n.js', 'rules.js', 'content-scan.js'] },
      function () {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      }
    );
  });
}

function injectMainWorld(tabId) {
  return new Promise(function (resolve, reject) {
    chrome.scripting.executeScript(
      { target: { tabId: tabId }, world: 'MAIN', files: ['main-world.js'] },
      function (results) {
        if (chrome.runtime.lastError) reject(new Error(t('err.injectMain', { msg: chrome.runtime.lastError.message })));
        else resolve();
      }
    );
  });
}

function sendToTab(tabId, msg) {
  return new Promise(function (resolve) {
    chrome.tabs.sendMessage(tabId, msg, function (resp) {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') || url.startsWith('about:');
}

function doCapture(tab) {
  return new Promise(function (resolve, reject) {
    if (!tab) { reject(new Error(t('err.invalidTab'))); return; }
    if (isRestrictedUrl(tab.url)) {
      reject(new Error(t('err.restricted')));
      return;
    }
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, function (dataUrl) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || t('err.capture')));
        return;
      }
      if (!dataUrl) { reject(new Error(t('err.noImageData'))); return; }
      resolve(dataUrl);
    });
  });
}
