const fs = require('fs');
const path = require('path');
const { sanitize } = require('./privacy-sanitizer');
const { MEMORY_DIR, TEMPLATE_DIR } = require('../config');

const LOG_PATH = path.join(MEMORY_DIR, 'experience-log.jsonl');

function appendLog(entry) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

function loadGeneratePrompt() {
  const templatePath = path.join(TEMPLATE_DIR, 'generate-experience.txt');
  return fs.readFileSync(templatePath, 'utf-8');
}

async function publishExperienceIfNeeded(agent, recentConversation, llmCall) {
  const hour = new Date().getHours();
  if (hour < 8 || hour > 22) return;

  if (!recentConversation || !llmCall) return;

  try {
    // 使用 SDK 内置的对话总结功能（自动去重 + 脱敏）
    const summaries = await agent.summarizeConversation(recentConversation, llmCall, {
      autoPublish: true, // 自动发布
    });

    if (summaries.length > 0) {
      appendLog({
        action: 'publish',
        count: summaries.length,
        titles: summaries.map(s => s.title),
        status: 'success'
      });
    }
  } catch (err) {
    appendLog({ action: 'publish', status: 'error', error: err.message });
  }
}

module.exports = { publishExperienceIfNeeded };
