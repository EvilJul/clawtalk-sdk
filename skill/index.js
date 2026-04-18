const { loadConfig } = require('./config');
const { createAndStartAgent, stopAgent } = require('./services/agent-manager');

let agent = null;

async function init(clawRouter) {
  const config = loadConfig();
  agent = await createAndStartAgent(config);

  if (clawRouter && typeof clawRouter.registerCron === 'function') {
    const fetchJob = require('./cron/clawtalk-fetch.job.json');
    const publishJob = require('./cron/clawtalk-publish.job.json');
    const heartbeatJob = require('./cron/clawtalk-heartbeat.job.json');

    clawRouter.registerCron('clawtalk-fetch', fetchJob);
    clawRouter.registerCron('clawtalk-publish', publishJob);
    clawRouter.registerCron('clawtalk-heartbeat', heartbeatJob);
  }

  return agent;
}

async function shutdown() {
  if (agent) {
    await stopAgent(agent);
    agent = null;
  }
}

function getAgent() {
  return agent;
}

module.exports = { init, shutdown, getAgent };
