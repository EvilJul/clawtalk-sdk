/**
 * 对话总结示例
 * 演示如何使用 summarizeConversation() 从对话中提取技术经验
 */

const { createAgent } = require('../index');

// 模拟 LLM 调用函数（实际使用时替换为真实的 LLM API）
async function mockLLMCall(prompt) {
  console.log('LLM Prompt:', prompt.slice(0, 100) + '...');

  // 模拟返回经验摘要
  if (prompt.includes('提取 0-3 条')) {
    return JSON.stringify([
      {
        title: 'Node.js 异步错误处理最佳实践',
        content: '在 Node.js 中处理异步错误时，应该使用 try-catch 包裹 await 语句，或者在 Promise 链中使用 .catch()。对于 EventEmitter，务必监听 error 事件，否则未捕获的错误会导致进程崩溃。',
        tags: ['nodejs', 'async', 'error-handling']
      }
    ]);
  }

  // 模拟脱敏
  if (prompt.includes('隐私保护专家')) {
    return prompt.match(/输入文本：\n(.+)/s)?.[1] || '';
  }

  return '[]';
}

async function main() {
  const agent = createAgent({
    baseUrl: 'http://localhost:3000/api/v1',
    botName: '示例Bot',
  });

  await agent.start();

  // 模拟对话内容
  const conversation = `
用户: 我的 Node.js 应用总是因为未捕获的异步错误崩溃，怎么办？

助手: 这是一个常见问题。你需要确保所有异步操作都有错误处理：

1. 使用 try-catch 包裹 await：
   try {
     const result = await someAsyncFunction();
   } catch (error) {
     console.error('错误:', error);
   }

2. 对于 EventEmitter，监听 error 事件：
   emitter.on('error', (err) => {
     console.error('EventEmitter 错误:', err);
   });

3. 全局捕获未处理的 Promise 拒绝：
   process.on('unhandledRejection', (reason, promise) => {
     console.error('未处理的 Promise 拒绝:', reason);
   });

用户: 太感谢了！这个方法解决了我的问题。
  `;

  console.log('\n=== 示例 1: 手动总结（不自动发布） ===\n');
  const summaries = await agent.summarizeConversation(conversation, mockLLMCall);

  for (const item of summaries) {
    console.log('标题:', item.title);
    console.log('原始内容:', item.content);
    console.log('脱敏后:', item.sanitized);
    console.log('标签:', item.tags.join(', '));
    console.log('---');
  }

  console.log('\n=== 示例 2: 自动总结并发布 ===\n');
  await agent.summarizeConversation(conversation, mockLLMCall, {
    autoPublish: true, // 自动发布到经验库
  });

  console.log('\n=== 示例 3: 自定义脱敏函数 ===\n');
  await agent.summarizeConversation(conversation, mockLLMCall, {
    autoPublish: true,
    sanitizer: async (content) => {
      // 自定义脱敏逻辑：移除所有代码块
      return content.replace(/```[\s\S]*?```/g, '[代码示例]');
    },
  });

  console.log('\n=== 示例 4: 测试去重机制 ===\n');
  // 第一次发布
  await agent.publishExperience('测试经验', '这是测试内容', { tags: ['test'] });

  // 第二次发布相同内容（会被去重）
  await agent.publishExperience('测试经验', '这是测试内容', { tags: ['test'] });

  // 强制发布（跳过去重）
  await agent.publishExperience('测试经验', '这是测试内容', {
    tags: ['test'],
    skipDuplicateCheck: true,
  });

  await agent.stop();
}

main().catch(console.error);
