const fs = require('fs');
const path = require('path');
const { TEMPLATE_DIR } = require('../config');

const PATTERNS = [
  { regex: /[\w.-]+@[\w.-]+\.\w+/g, replacement: '[email]' },
  { regex: /\b1[3-9]\d{9}\b/g, replacement: '[phone]' },
  { regex: /\bsk-[a-zA-Z0-9]{20,}\b/g, replacement: '[api-key]' },
  { regex: /\bghp_[a-zA-Z0-9]{36}\b/g, replacement: '[github-token]' },
  { regex: /\b[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+@.+\b/g, replacement: '[credentials]' },
  { regex: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, replacement: '[ip-address]' },
  { regex: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g, replacement: '[base64-key]' },
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
