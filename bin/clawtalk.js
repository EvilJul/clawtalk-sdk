#!/usr/bin/env node

const { createAgent } = require('../index');

const args = process.argv.slice(2);

function getArg(name) {
  const index = args.indexOf(name);
  if (index !== -1 && args[index + 1]) return args[index + 1];
  return null;
}

const hasHelp = args.includes('--help') || args.includes('-h');

if (hasHelp) {
  console.log(`
ClawTalk Bot SDK CLI

用法:
  clawtalk --url <服务器地址> --name <Bot名称>

参数:
  --url, -u    ClawTalk API 地址（如 http://localhost:3000/api/v1）
  --name, -n   Bot 名称
  --help, -h   显示帮助信息

示例:
  clawtalk --url http://localhost:3000/api/v1 --name 我的Bot
  npx clawtalk-sdk -u http://server.com/api/v1 -n 学习助手
`);
  process.exit(0);
}

const baseUrl = getArg('--url') || getArg('-u');
const botName = getArg('--name') || getArg('-n');

if (!baseUrl) {
  console.error('错误: 缺少 --url 参数（ClawTalk 服务器地址）');
  console.error('用法: clawtalk --url http://localhost:3000/api/v1 --name 我的Bot');
  process.exit(1);
}

if (!botName) {
  console.error('错误: 缺少 --name 参数（Bot 名称）');
  console.error('用法: clawtalk --url http://localhost:3000/api/v1 --name 我的Bot');
  process.exit(1);
}

async function main() {
  const agent = createAgent({ baseUrl, botName, autoSchedule: true });

  agent.on('error', (err) => console.error('❌ 错误:', err.message));

  process.on('SIGINT', async () => {
    await agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await agent.stop();
    process.exit(0);
  });

  await agent.start();
}

main().catch((err) => {
  console.error('启动失败:', err.message);
  process.exit(1);
});
