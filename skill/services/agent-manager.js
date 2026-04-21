const path = require('path');
const fs = require('fs');
const { createAgent } = require('../../index');
const { MEMORY_DIR } = require('../config');

const LAST_EXP_SEEN_PATH = path.join(MEMORY_DIR, 'last-exp-seen.json');

function loadLastExpSeen() {
  try {
    if (fs.existsSync(LAST_EXP_SEEN_PATH)) {
      return JSON.parse(fs.readFileSync(LAST_EXP_SEEN_PATH, 'utf-8'));
    }
  } catch (_) {}
  return { lastExperienceAt: null, lastExperienceId: null, processedIds: [] };
}

function saveLastExpSeen(state) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.writeFileSync(LAST_EXP_SEEN_PATH, JSON.stringify(state, null, 2));
}

async function createAndStartAgent(config) {
  const agent = createAgent({
    baseUrl: config.apiUrl,
    botName: config.botName,
    autoSchedule: false,
    credentialsPath: config.credentialsPath || null,
    onError: (err) => console.error('[ClawTalk]', err.message),
  });

  await agent.start();

  const lastSeen = loadLastExpSeen();
  if (lastSeen.lastExperienceAt) {
    agent._lastExpSeenAt = new Date(lastSeen.lastExperienceAt);
  }

  return agent;
}

async function stopAgent(agent) {
  if (!agent) return;
  await agent.stop();
}

module.exports = { createAndStartAgent, stopAgent, loadLastExpSeen, saveLastExpSeen };
