(function (global) {
  'use strict';

  if (global.SafeShotI18n) return;

  const DICT = {
    zh: {
      'menu.capture': 'SafeShot 打码截图',
      'badge.titlePrefix': 'SafeShot：',
      'badge.reset': 'SafeShot 安全截图',

      'toast.copied': '已复制到剪贴板',
      'toast.captureFailed': '截图失败：',
      'toast.downloadedDiag': '已下载截图〔{diag}〕',
      'diag.whitelist': '白名单',
      'misc.notAttempted': '未尝试',

      'ui.toolbarHint': '拖拽添加遮罩 · 点击遮罩删除',
      'ui.keyHint': 'Enter 确认 · Esc 取消',
      'ui.cancel': '取消',
      'ui.confirmCapture': '确认截图',
      'ui.fullPage': '整页',
      'mask.deleteThis': '点击删除此遮罩',
      'mask.auto': '自动扫描遮罩',

      'err.noActiveTab': '未找到活动标签页',
      'err.invalidTab': '无效标签页',
      'err.restricted': '浏览器内置页面不支持截图',
      'err.imageProcess': '图片处理失败',
      'err.fullPageFailed': '整页截图失败',
      'err.fullPageTooLarge': '页面过长，无法整页截图',
      'err.copyTimeout': '复制超时',
      'err.copyFailed': '复制失败',
      'err.clipWriteFailed': '剪贴板写入失败',
      'err.copyThenDownload': '复制失败: {a}；下载也失败: {b}',
      'err.injectMain': '注入MAIN失败: {msg}',
      'err.capture': '截图失败',
      'err.noImageData': '未获取到截图数据',
      'err.notSecureContext': '页面非安全上下文',
      'err.clipTimeout': '剪贴板写入超时',
      'err.unknown': '未知错误',
      'err.iframeCopyFailed': 'iframe 复制失败',
      'err.iframeCopyTimeout': 'iframe 复制超时',
      'err.execFalse': 'execCommand 返回 false',
      'err.imgLoadFailed': '图片加载失败',
      'err.bestEffort': 'iframe: {a}；exec: {b}',
      'err.emptyBlob': '图片数据为空',
      'err.writeFailed': '写入失败',

      'popup.slogan': '安全截图 · 零依赖',
      'popup.statusReady': '就绪',
      'popup.btnCapture': '📷 打码截图',
      'popup.btnSettings': '⚙️ 设置',
      'popup.back': '‹ 返回',
      'popup.settings': '设置',
      'popup.statusStarting': '正在启动，请在页面上操作…',
      'popup.statusNoTab': '未找到活动标签页',
      'popup.statusRestricted': '浏览器内置页面不支持截图',
      'popup.statusCanceled': '已取消',
      'popup.statusFailed': '操作失败',
      'popup.statusDownloaded': '已下载（{err}）',
      'popup.enableAutoScan': '启用自动扫描',
      'popup.hintAutoScan': '开启后截图前自动识别敏感信息并打码；关闭后仍可截图和手动打码',
      'popup.langSection': '界面语言',
      'popup.hintLang': '切换扩展界面与提示的语言，「自动」跟随浏览器语言',
      'popup.langAuto': '自动（跟随浏览器）',
      'popup.langZh': '中文',
      'popup.langEn': 'English',
      'popup.maskStyle': '遮罩样式',
      'popup.hintMaskStyle': '选择截图打码的遮罩效果',
      'popup.maskMosaic': '马赛克',
      'popup.maskColor': '纯色',
      'popup.blockSize': '块大小',
      'popup.color': '颜色',
      'popup.shortcut': '快捷键',
      'popup.hintShortcut': '在任意页面按快捷键启动截图',
      'popup.currentShortcut': '当前键位',
      'popup.edit': '修改',
      'popup.shortcutUnset': '未设置',
      'popup.whitelist': '域名白名单',
      'popup.hintWhitelist': '白名单内的网站点击截图时会跳过扫描',
      'popup.whitelistPlaceholder': '例如：github.com',
      'popup.add': '添加',
      'popup.customRules': '自定义正则规则',
      'popup.hintCustomRules': '添加你自己的敏感信息识别规则',
      'popup.rulePlaceholder': '正则，如：[A-Z]{2}\\\\d{6}',
      'popup.alertDupWhitelist': '该域名已在白名单中',
      'popup.alertBadRegex': '无效的正则表达式：',

      'rule.password': '密码输入框',
      'rule.apiKey': 'API 密钥',
      'rule.bearerToken': 'Bearer Token',
      'rule.authHeader': 'Authorization 头',
      'rule.jwt': 'JWT Token',
      'rule.phone': '手机号',
      'rule.email': '邮箱',
      'rule.internalIp': '内网 IP',
      'rule.internalDomain': '内网域名',
      'rule.dbUrl': '数据库连接串',
      'rule.privateKey': '私钥'
    },

    en: {
      'menu.capture': 'SafeShot Redacted Screenshot',
      'badge.titlePrefix': 'SafeShot: ',
      'badge.reset': 'SafeShot Secure Screenshot',

      'toast.copied': 'Copied to clipboard',
      'toast.captureFailed': 'Capture failed: ',
      'toast.downloadedDiag': 'Screenshot downloaded [{diag}]',
      'diag.whitelist': 'whitelist',
      'misc.notAttempted': 'not attempted',

      'ui.toolbarHint': 'Drag to add mask · Click a mask to remove',
      'ui.keyHint': 'Enter confirm · Esc cancel',
      'ui.cancel': 'Cancel',
      'ui.confirmCapture': 'Capture',
      'ui.fullPage': 'Full page',
      'mask.deleteThis': 'Click to remove this mask',
      'mask.auto': 'Auto-scanned mask',

      'err.noActiveTab': 'No active tab found',
      'err.invalidTab': 'Invalid tab',
      'err.restricted': 'Browser built-in pages cannot be captured',
      'err.imageProcess': 'Image processing failed',
      'err.fullPageFailed': 'Full-page capture failed',
      'err.fullPageTooLarge': 'Page too long for full-page capture',
      'err.copyTimeout': 'Copy timed out',
      'err.copyFailed': 'Copy failed',
      'err.clipWriteFailed': 'Clipboard write failed',
      'err.copyThenDownload': 'Copy failed: {a}; download also failed: {b}',
      'err.injectMain': 'MAIN injection failed: {msg}',
      'err.capture': 'Capture failed',
      'err.noImageData': 'No screenshot data returned',
      'err.notSecureContext': 'Page is not a secure context',
      'err.clipTimeout': 'Clipboard write timed out',
      'err.unknown': 'Unknown error',
      'err.iframeCopyFailed': 'iframe copy failed',
      'err.iframeCopyTimeout': 'iframe copy timed out',
      'err.execFalse': 'execCommand returned false',
      'err.imgLoadFailed': 'Image failed to load',
      'err.bestEffort': 'iframe: {a}; exec: {b}',
      'err.emptyBlob': 'Image data is empty',
      'err.writeFailed': 'Write failed',

      'popup.slogan': 'Secure Screenshots · Zero Dependencies',
      'popup.statusReady': 'Ready',
      'popup.btnCapture': '📷 Redact & Capture',
      'popup.btnSettings': '⚙️ Settings',
      'popup.back': '‹ Back',
      'popup.settings': 'Settings',
      'popup.statusStarting': 'Starting… please interact with the page',
      'popup.statusNoTab': 'No active tab found',
      'popup.statusRestricted': 'Browser built-in pages cannot be captured',
      'popup.statusCanceled': 'Canceled',
      'popup.statusFailed': 'Operation failed',
      'popup.statusDownloaded': 'Downloaded ({err})',
      'popup.enableAutoScan': 'Enable auto scan',
      'popup.hintAutoScan': 'Detect and mask sensitive info before capture. You can still capture and mask manually when off.',
      'popup.langSection': 'Language',
      'popup.hintLang': 'Language of the UI and notifications. "Auto" follows the browser language.',
      'popup.langAuto': 'Auto (follow browser)',
      'popup.langZh': '中文',
      'popup.langEn': 'English',
      'popup.maskStyle': 'Mask style',
      'popup.hintMaskStyle': 'Choose how masked regions look in the screenshot',
      'popup.maskMosaic': 'Mosaic',
      'popup.maskColor': 'Solid color',
      'popup.blockSize': 'Block size',
      'popup.color': 'Color',
      'popup.shortcut': 'Shortcut',
      'popup.hintShortcut': 'Press the shortcut on any page to start capture',
      'popup.currentShortcut': 'Current keys',
      'popup.edit': 'Change',
      'popup.shortcutUnset': 'Not set',
      'popup.whitelist': 'Domain whitelist',
      'popup.hintWhitelist': 'Whitelisted sites skip scanning when capturing',
      'popup.whitelistPlaceholder': 'e.g. github.com',
      'popup.add': 'Add',
      'popup.customRules': 'Custom regex rules',
      'popup.hintCustomRules': 'Add your own sensitive-info detection rules',
      'popup.rulePlaceholder': 'Regex, e.g. [A-Z]{2}\\\\d{6}',
      'popup.alertDupWhitelist': 'This domain is already whitelisted',
      'popup.alertBadRegex': 'Invalid regular expression: ',

      'rule.password': 'Password field',
      'rule.apiKey': 'API key',
      'rule.bearerToken': 'Bearer token',
      'rule.authHeader': 'Authorization header',
      'rule.jwt': 'JWT token',
      'rule.phone': 'Phone number',
      'rule.email': 'Email',
      'rule.internalIp': 'Internal IP',
      'rule.internalDomain': 'Internal domain',
      'rule.dbUrl': 'Database connection string',
      'rule.privateKey': 'Private key'
    }
  };

  let setting = 'auto';
  let lang = null;
  let seedPromise = null;

  function detect() {
    let ui = '';
    try {
      if (global.chrome && chrome.i18n && chrome.i18n.getUILanguage) {
        ui = chrome.i18n.getUILanguage();
      }
    } catch (e) {}
    if (!ui && global.navigator) ui = navigator.language || '';
    return /^zh/i.test(ui) ? 'zh' : 'en';
  }

  function resolve(value) {
    return value === 'zh' || value === 'en' ? value : detect();
  }

  function current() {
    return lang || resolve(setting);
  }

  function setSetting(value) {
    setting = value === 'zh' || value === 'en' ? value : 'auto';
    lang = resolve(setting);
  }

  function t(key, vars) {
    const language = current();
    let text = DICT[language] ? DICT[language][key] : undefined;
    if (typeof text !== 'string') text = DICT.en[key];
    if (typeof text !== 'string') text = DICT.zh[key];
    if (typeof text !== 'string') text = key;
    if (vars) {
      for (const name in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, name)) {
          text = text.split('{' + name + '}').join(String(vars[name]));
        }
      }
    }
    return text;
  }

  function applyLangAttr() {
    try {
      if (global.document && document.documentElement) {
        document.documentElement.setAttribute('data-safeshot-lang', current());
      }
    } catch (e) {}
  }

  function onStorageChanged(changes, area) {
    if (area !== 'local' || !changes || !changes.lang) return;
    setSetting(changes.lang.newValue);
    applyLangAttr();
  }

  try {
    if (global.chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(onStorageChanged);
    }
  } catch (e) {}

  function init() {
    if (seedPromise) return seedPromise;
    seedPromise = (async function () {
      if (!(global.chrome && chrome.storage && chrome.storage.local)) {
        lang = resolve(setting);
        applyLangAttr();
        return current();
      }
      try {
        const data = await chrome.storage.local.get(['lang']);
        setSetting(data.lang);
      } catch (e) {
        lang = resolve(setting);
      }
      applyLangAttr();
      return current();
    })();
    return seedPromise;
  }

  lang = resolve(setting);
  init();

  global.SafeShotI18n = {
    t: t,
    detect: detect,
    resolve: resolve,
    init: init,
    setSetting: setSetting,
    getLang: current,
    applyLangAttr: applyLangAttr,
    LANG_KEY: 'lang',
    LANGS: ['auto', 'zh', 'en']
  };
})(typeof self !== 'undefined' ? self : globalThis);
