const fs = require('fs');
const path = require('path');
const { loadLastExpSeen, saveLastExpSeen } = require('./agent-manager');
const { MEMORY_DIR, TEMPLATE_DIR } = require('../config');

const LOG_PATH = path.join(MEMORY_DIR, 'experience-log.jsonl');

function appendLog(entry) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

function loadTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf-8');
}

async function evaluateRelevance(exp, llmCall, context) {
  if (typeof llmCall !== 'function') return true;

  try {
    const prompt = loadTemplate('evaluate-relevance.txt')
      .replace('{techStack}', context.techStack || '未知')
      .replace('{currentProject}', context.currentProject || '未知')
      .replace('{title}', exp.title)
      .replace('{tags}', (exp.tags || []).join(', '))
      .replace('{content}', exp.content);

    const result = await llmCall(prompt);
    return result && result.toLowerCase().includes('yes');
  } catch (_) {
    return true;
  }
}

async function evaluateQuality(exp, llmCall) {
  if (exp.upvote_count >= 5) return true;

  if (typeof llmCall !== 'function') return exp.upvote_count >= 1;

  try {
    const prompt = loadTemplate('evaluate-quality.txt')
      .replace('{title}', exp.title)
      .replace('{content}', exp.content)
      .replace('{bot_name}', exp.bot_name || '未知')
      .replace('{created_at}', exp.created_at || '')
      .replace('{now}', new Date().toISOString());

    const raw = await llmCall(prompt);
    const parsed = JSON.parse(raw);
    return parsed.pass === true;
  } catch (_) {
    return exp.upvote_count >= 1;
  }
}

async function fetchAndAbsorbExperiences(agent, options = {}) {
  const { llmCall, context = {}, onAbsorb } = options;

  try {
    const result = await agent.getExperiences({ limit: 10 });
    if (!result || !result.experiences || result.experiences.length === 0) return;
    const state = loadLastExpSeen();
    const processedSet = new Set(state.processedIds || []);

    for (const exp of result.experiences) {
      if (processedSet.has(exp.id)) continue;

      const relevant = await evaluateRelevance(exp, llmCall, context);
      if (!relevant) {
        appendLog({ action: 'skip', expId: exp.id, title: exp.title, reason: 'irrelevant' });
        continue;
      }

      const quality = await evaluateQuality(exp, llmCall);
      if (!quality) {
        appendLog({ action: 'skip', expId: exp.id, title: exp.title, reason: 'low-quality' });
        continue;
      }

      if (typeof onAbsorb === 'function') {
        await onAbsorb(exp);
      }

      await agent.upvoteExperience(exp.id);

      processedSet.add(exp.id);
      appendLog({ action: 'absorb', expId: exp.id, title: exp.title, relevance: true, quality: true });
    }

    const latestExp = result.experiences[0];
    saveLastExpSeen({
      lastExperienceAt: latestExp.created_at,
      lastExperienceId: latestExp.id,
      processedIds: Array.from(processedSet).slice(-200),
    });
  } catch (err) {
    appendLog({ action: 'fetch', status: 'error', error: err.message });
  }
}

module.exports = { fetchAndAbsorbExperiences };
