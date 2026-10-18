(function (global) {
  'use strict';

  const DEFAULT_RULES = [
    {
      id: 'password',
      type: 'input',
      selector: 'input[type="password"], input[name*="password" i], textarea[name*="password" i]',
      enabled: true,
      label: 'rule.password'
    },
    {
      id: 'api_key',
      type: 'regex',
      pattern: '(sk-[A-Za-z0-9_-]{16,}|sk_live_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{22,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[0-9A-Za-z-]{10,}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{36})',
      flags: 'g',
      enabled: true,
      label: 'rule.apiKey'
    },
    {
      id: 'bearer_token',
      type: 'regex',
      pattern: '(?:Bearer|Basic|Token)\\s+[A-Za-z0-9._~+/=-]{16,}',
      flags: 'g',
      enabled: true,
      label: 'rule.bearerToken'
    },
    {
      id: 'authorization_header',
      type: 'regex',
      pattern: 'Authorization\\s*[:=]\\s*\\S+\\s+\\S+',
      flags: 'gi',
      enabled: true,
      label: 'rule.authHeader'
    },
    {
      id: 'jwt',
      type: 'regex',
      pattern: 'eyJ[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]{5,}',
      flags: 'g',
      enabled: true,
      label: 'rule.jwt'
    },
    {
      id: 'phone',
      type: 'regex',
      pattern: '(?<!\\d)(?:\\+?86[\\s-]?)?1[3-9](?:[\\s-]?\\d){9}(?!\\d)',
      flags: 'g',
      enabled: true,
      label: 'rule.phone'
    },
    {
      id: 'email',
      type: 'regex',
      pattern: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}',
      flags: 'g',
      enabled: true,
      label: 'rule.email'
    },
    {
      id: 'internal_ip',
      type: 'regex',
      pattern: '(10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|172\\.(1[6-9]|2[0-9]|3[01])\\.\\d{1,3}\\.\\d{1,3})',
      flags: 'g',
      enabled: true,
      label: 'rule.internalIp'
    },
    {
      id: 'internal_ip6',
      type: 'regex',
      pattern: '(?<![0-9A-Za-z])(?:(?:f[cd][0-9a-f]{0,3}|fe[89ab][0-9a-f]{0,3}):[0-9a-f:]{1,39}|::1)(?![0-9A-Za-z:])',
      flags: 'gi',
      enabled: true,
      label: 'rule.internalIp'
    },
    {
      id: 'internal_domain',
      type: 'regex',
      pattern: '([a-z0-9-]+\\.(internal|local|corp|lan))',
      flags: 'gi',
      enabled: true,
      label: 'rule.internalDomain'
    },
    {
      id: 'db_url',
      type: 'regex',
      pattern: '(mysql|postgresql?|mongodb|redis|amqp)://[^\\s"\'<>\\)]+',
      flags: 'gi',
      enabled: true,
      label: 'rule.dbUrl'
    },
    {
      id: 'private_key',
      type: 'regex',
      pattern: '-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----[\\s\\S]*?-----END (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----',
      flags: 'g',
      enabled: true,
      label: 'rule.privateKey'
    }
  ];

  function buildRegexFromRule(rule) {
    try {
      return new RegExp(rule.pattern, rule.flags || 'g');
    } catch (e) {
      return null;
    }
  }

  async function getEnabledRules() {
    let custom = [];
    try {
      const data = await chrome.storage.local.get(['customRules']);
      custom = data.customRules || [];
    } catch (e) {
      custom = [];
    }
    const all = DEFAULT_RULES.concat(custom);
    return all.filter(function (r) { return r.enabled !== false; });
  }

  global.SafeShotRules = {
    DEFAULT_RULES: DEFAULT_RULES,
    getEnabledRules: getEnabledRules,
    buildRegexFromRule: buildRegexFromRule
  };
})(typeof window !== 'undefined' ? window : globalThis);
