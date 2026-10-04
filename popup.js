'use strict';

const t = SafeShotI18n.t;

let currentTab = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await SafeShotI18n.init();
  applyI18n();

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0] || null;

  document.getElementById('capture-btn').addEventListener('click', capture);
  document.getElementById('settings-btn').addEventListener('click', () => showView('settings-view'));
  document.getElementById('back-btn').addEventListener('click', () => showView('main-view'));

  document.getElementById('add-whitelist').addEventListener('click', addWhitelist);
  document.getElementById('add-rule').addEventListener('click', addCustomRule);
  document.getElementById('global-enable').addEventListener('change', toggleGlobal);
  document.getElementById('ui-lang').addEventListener('change', saveLang);

  document.getElementById('mask-mode').addEventListener('change', saveMaskStyle);
  document.getElementById('mask-block').addEventListener('input', saveMaskStyle);
  document.getElementById('mask-color').addEventListener('input', saveMaskStyle);

  document.getElementById('edit-shortcut').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  loadSettings();
}

function applyI18n() {
  document.documentElement.lang = SafeShotI18n.getLang() === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
}

function saveLang(e) {
  const value = e.target.value;
  SafeShotI18n.setSetting(value);
  chrome.storage.local.set({ [SafeShotI18n.LANG_KEY]: value });
  applyI18n();
  loadShortcut();
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function setStatus(msg, isError) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = isError ? '#ef4444' : '#6b7280';
}

async function capture() {
  if (!currentTab) { setStatus(t('popup.statusNoTab'), true); return; }
  if (isRestrictedUrl(currentTab.url)) { setStatus(t('popup.statusRestricted'), true); return; }

  setStatus(t('popup.statusStarting'));

  try {
    const resp = await sendToBackground({ type: 'start-capture' });
    if (!resp) throw new Error(t('popup.statusFailed'));
    if (resp.canceled) { setStatus(t('popup.statusCanceled')); return; }
    if (!resp.ok) throw new Error(resp.error || t('popup.statusFailed'));
    if (resp.done) {
      setStatus(resp.mode === 'download'
        ? t('popup.statusDownloaded', { err: resp.error || t('err.copyFailed') })
        : t('toast.copied'));
    }
  } catch (err) {
    setStatus(err.message || t('popup.statusFailed'), true);
  }
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') || url.startsWith('about:');
}

function sendToBackground(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

async function loadSettings() {
  const data = await chrome.storage.local.get(['enabled', 'whitelist', 'customRules', 'maskStyle', 'lang']);
  document.getElementById('global-enable').checked = data.enabled !== false;
  document.getElementById('ui-lang').value = data.lang || 'auto';

  loadShortcut();

  const ms = Object.assign({ mode: 'mosaic', block: 12, color: '#000000' }, data.maskStyle || {});
  document.getElementById('mask-mode').value = ms.mode;
  document.getElementById('mask-block').value = ms.block;
  document.getElementById('mask-block-val').textContent = ms.block + 'px';
  document.getElementById('mask-color').value = ms.color;
  updateMaskRows(ms.mode);

  const wlList = document.getElementById('whitelist-list');
  wlList.innerHTML = '';
  (data.whitelist || []).forEach((host, idx) => {
    const li = document.createElement('li');
    li.innerHTML = '<span>' + escapeHtml(host) + '</span><span class="del" data-i="' + idx + '">×</span>';
    wlList.appendChild(li);
  });
  wlList.querySelectorAll('.del').forEach(el => {
    el.addEventListener('click', () => removeWhitelist(parseInt(el.dataset.i, 10)));
  });

  const ruleList = document.getElementById('custom-rule-list');
  ruleList.innerHTML = '';
  (data.customRules || []).forEach((rule, idx) => {
    const li = document.createElement('li');
    li.innerHTML = '<span>' + escapeHtml(rule.pattern) + '</span><span class="del" data-i="' + idx + '">×</span>';
    ruleList.appendChild(li);
  });
  ruleList.querySelectorAll('.del').forEach(el => {
    el.addEventListener('click', () => removeCustomRule(parseInt(el.dataset.i, 10)));
  });
}

function addWhitelist() {
  const input = document.getElementById('whitelist-input');
  let host = input.value.trim().toLowerCase();
  if (!host) return;
  host = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  chrome.storage.local.get(['whitelist'], (data) => {
    const wl = data.whitelist || [];
    if (wl.indexOf(host) >= 0) { alert(t('popup.alertDupWhitelist')); return; }
    wl.push(host);
    chrome.storage.local.set({ whitelist: wl }, () => {
      input.value = '';
      loadSettings();
    });
  });
}

function removeWhitelist(idx) {
  chrome.storage.local.get(['whitelist'], (data) => {
    const wl = data.whitelist || [];
    wl.splice(idx, 1);
    chrome.storage.local.set({ whitelist: wl }, loadSettings);
  });
}

function addCustomRule() {
  const input = document.getElementById('custom-pattern');
  const pattern = input.value.trim();
  if (!pattern) return;
  try { new RegExp(pattern); } catch (e) { alert(t('popup.alertBadRegex') + e.message); return; }
  chrome.storage.local.get(['customRules'], (data) => {
    const rules = data.customRules || [];
    rules.push({ id: 'custom_' + Date.now(), type: 'regex', pattern: pattern, flags: 'g', enabled: true });
    chrome.storage.local.set({ customRules: rules }, () => {
      input.value = '';
      loadSettings();
    });
  });
}

function removeCustomRule(idx) {
  chrome.storage.local.get(['customRules'], (data) => {
    const rules = data.customRules || [];
    rules.splice(idx, 1);
    chrome.storage.local.set({ customRules: rules }, loadSettings);
  });
}

function toggleGlobal(e) {
  chrome.storage.local.set({ enabled: e.target.checked });
}

function updateMaskRows(mode) {
  document.getElementById('mask-block-row').classList.toggle('hidden', mode !== 'mosaic');
  document.getElementById('mask-color-row').classList.toggle('hidden', mode !== 'color');
}

async function loadShortcut() {
  const sec = document.getElementById('shortcut-section');
  if (typeof chrome.commands === 'undefined') { sec.classList.add('hidden'); return; }
  try {
    const cmds = await chrome.commands.getAll();
    const cmd = (cmds || []).find(c => c.name === 'start-capture');
    document.getElementById('shortcut-display').textContent = (cmd && cmd.shortcut) || t('popup.shortcutUnset');
  } catch (e) {
    document.getElementById('shortcut-display').textContent = t('popup.shortcutUnset');
  }
}

function saveMaskStyle() {
  const mode = document.getElementById('mask-mode').value;
  const block = parseInt(document.getElementById('mask-block').value, 10) || 12;
  const color = document.getElementById('mask-color').value || '#000000';
  document.getElementById('mask-block-val').textContent = block + 'px';
  updateMaskRows(mode);
  chrome.storage.local.set({ maskStyle: { mode: mode, block: block, color: color } });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
