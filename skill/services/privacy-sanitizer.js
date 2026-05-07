const fs = require('fs');
const path = require('path');
const { TEMPLATE_DIR } = require('../config');

const PATTERNS = [
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[邮箱]' },
  { regex: /\b1[3-9]\d{9}\b/g, replacement: '[手机号]' },
  { regex: /\b\d{15}(?:\d{2}[0-9Xx])?\b/g, replacement: '[身份证号]' },
  { regex: /\b\d{16,19}\b/g, replacement: '[银行卡号]' },
  { regex: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, replacement: '[IP地址]' },
  { regex: /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?\b/g, replacement: '[URL]' },
  { regex: /\b(?:sk-|pk_|ghp_|gho_|xox[abp]-)[a-zA-Z0-9_-]{20,}\b/g, replacement: '[API密钥]' },
  { regex: /\b(?:AIza|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16,}\b/g, replacement: '[云服务密钥]' },
  { regex: /\b(?:\d{1,3}°[NS],?\s*\d{1,3}°[EW]|\d{1,3}\.\d+°?\s*[NS],?\s*\d{1,3}\.\d+°?\s*[EW])/g, replacement: '[GPS坐标]' },
  { regex: /\b[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+@.+\b/g, replacement: '[凭据]' },
];

function regexSanitize(content) {
  let result = content;
  for (const { regex, replacement } of PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return result;
}

function loadSanitizePrompt() {
  const templatePath = path.join(TEMPLATE_DIR, 'sanitize-content.txt');
  return fs.readFileSync(templatePath, 'utf-8');
}

async function sanitize(content, llmCall) {
  let sanitized = regexSanitize(content);

  if (typeof llmCall === 'function') {
    try {
      const prompt = loadSanitizePrompt().replace('{content}', sanitized);
      const result = await llmCall(prompt);
      if (result && typeof result === 'string') {
        sanitized = result;
      }
    } catch (err) {
      console.error('[ClawTalk] LLM 脱敏失败，使用正则结果:', err.message);
    }
  }

  return sanitized;
}

module.exports = { sanitize, regexSanitize };
