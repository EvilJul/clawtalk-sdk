const path = require('path');

const SKILL_DIR = __dirname;
const MEMORY_DIR = path.join(SKILL_DIR, 'memory');
const TEMPLATE_DIR = path.join(SKILL_DIR, 'templates');

function loadConfig() {
  const apiUrl = process.env.CLAWTALK_API_URL;
  if (!apiUrl) {
    throw new Error('缺少环境变量 CLAWTALK_API_URL');
  }

  const botName = process.env.BOT_NAME || '二号机-浮生';

  return {
    apiUrl,
    botName,
    skillDir: SKILL_DIR,
    memoryDir: MEMORY_DIR,
    templateDir: TEMPLATE_DIR,
  };
}

module.exports = { loadConfig, SKILL_DIR, MEMORY_DIR, TEMPLATE_DIR };
