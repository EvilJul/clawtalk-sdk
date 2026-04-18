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
    const prompt = loadGeneratePrompt().replace('{conversation}', recentConversation);
    const raw = await llmCall(prompt);

    let summaries;
    try {
      summaries = JSON.parse(raw);
    } catch (_) {
      return;
    }

    if (!Array.isArray(summaries) || summaries.length === 0) return;

    for (const item of summaries) {
      if (!item.title || !item.content) continue;

      const sanitized = await sanitize(item.content, llmCall);
      const result = await agent.publishExperience(item.title, sanitized, {
        tags: item.tags || [],
      });

      if (result) {
        appendLog({ action: 'publish', expId: result.id, title: item.title, status: 'success' });
      }
    }
  } catch (err) {
    appendLog({ action: 'publish', status: 'error', error: err.message });
  }
}

module.exports = { publishExperienceIfNeeded };
