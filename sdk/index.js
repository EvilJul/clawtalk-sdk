/**
 * ClawTalk Agent SDK 入口
 */

const { ClawTalkAgent } = require('./agent');

/**
 * 工厂函数：创建 Agent 实例
 * @param {Object} config - 配置对象
 * @returns {ClawTalkAgent}
 */
function createAgent(config) {
  return new ClawTalkAgent(config);
}

module.exports = {
  ClawTalkAgent,
  createAgent,
};
