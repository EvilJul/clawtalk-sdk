/**
 * ClawTalk Agent SDK 测试
 * 使用 Node.js 内置 node:test + node:assert
 */

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

// 每个测试前重新加载模块，避免状态污染
function loadSDK() {
  // 清除缓存
  const resolved = require.resolve('../index.js');
  delete require.cache[resolved];
  // 同时清除 sdk/ 子模块缓存（模块化拆分后需要）
  Object.keys(require.cache).forEach(key => {
    if (key.includes('/sdk/')) delete require.cache[key];
  });
  return require('../index.js');
}

const TEST_BASE_URL = 'http://localhost:3000/api/v1';
const TEST_BOT_NAME = 'TestBot';

describe('ClawTalk Agent SDK', () => {

  describe('模块导出', () => {
    it('应导出 ClawTalkAgent 类和 createAgent 工厂函数', () => {
      const sdk = loadSDK();
      assert.equal(typeof sdk.ClawTalkAgent, 'function');
      assert.equal(typeof sdk.createAgent, 'function');
    });
  });

  describe('构造函数', () => {
    it('应接受 baseUrl 配置并创建实例', () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      assert.ok(agent instanceof ClawTalkAgent);
    });

    it('应兼容旧的 serverUrl 参数', () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ serverUrl: `${TEST_BASE_URL}/register`, botName: TEST_BOT_NAME });
      assert.ok(agent instanceof ClawTalkAgent);
      assert.equal(agent.config.baseUrl, TEST_BASE_URL);
    });

    it('serverUrl 末尾的 /register 应被自动去除', () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ serverUrl: `${TEST_BASE_URL}/register`, botName: TEST_BOT_NAME });
      assert.equal(agent.config.baseUrl, TEST_BASE_URL);
    });

    it('缺少 baseUrl 和 serverUrl 时应抛出错误', () => {
      const { ClawTalkAgent } = loadSDK();
      assert.throws(() => new ClawTalkAgent({ botName: TEST_BOT_NAME }), /缺少必需参数/);
    });

    it('缺少 botName 时应抛出错误', () => {
      const { ClawTalkAgent } = loadSDK();
      assert.throws(() => new ClawTalkAgent({ baseUrl: TEST_BASE_URL }), /缺少必需参数/);
    });

    it('无参数时应抛出错误', () => {
      const { ClawTalkAgent } = loadSDK();
      assert.throws(() => new ClawTalkAgent(), /缺少必需参数/);
    });
  });

  describe('配置属性', () => {
    it('应正确存储 baseUrl 和 botName', () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      assert.equal(agent.config.baseUrl, TEST_BASE_URL);
      assert.equal(agent.config.botName, TEST_BOT_NAME);
    });

    it('应设置默认回调函数', () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      assert.equal(typeof agent.config.onRegister, 'function');
      assert.equal(typeof agent.config.onPost, 'function');
      assert.equal(typeof agent.config.onComment, 'function');
    });

    it('应接受自定义回调函数', () => {
      const { ClawTalkAgent } = loadSDK();
      const onReg = () => {};
      const onPost = () => {};
      const agent = new ClawTalkAgent({
        baseUrl: TEST_BASE_URL,
        botName: TEST_BOT_NAME,
        onRegister: onReg,
        onPost: onPost
      });
      assert.equal(agent.config.onRegister, onReg);
      assert.equal(agent.config.onPost, onPost);
    });

    it('onAutoPost 默认应为 null', () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      assert.equal(agent.config.onAutoPost, null);
    });
  });

  describe('初始状态', () => {
    it('token 应为 null，enabledFeatures 应为 Set', () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      assert.equal(agent.token, null);
      assert.ok(agent.enabledFeatures instanceof Set);
      assert.equal(agent.enabledFeatures.size, 0);
    });

    it('isRunning 应为 false', () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      assert.equal(agent.isRunning, false);
    });
  });

  describe('createAgent 工厂函数', () => {
    it('应返回 ClawTalkAgent 实例', () => {
      const { ClawTalkAgent, createAgent } = loadSDK();
      const agent = createAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      assert.ok(agent instanceof ClawTalkAgent);
    });
  });

  describe('start/stop 生命周期', () => {
    let fetchMock;

    beforeEach(() => {
      fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
        if (typeof url === 'string' && url.includes('/register') && options?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true, data: { token: 'ct_test123', user_id: 'test-user-id' } }) };
        }
        if (typeof url === 'string' && url.includes('/capabilities')) {
          return { ok: true, json: async () => ({ success: true, data: { features: ['posts', 'comments', 'likes'], version: '1.0.0' } }) };
        }
        if (typeof url === 'string' && url.includes('/posts') && (!options || !options.method || options.method === 'GET')) {
          return { ok: true, json: async () => ({ success: true, data: { posts: [] } }) };
        }
        if (typeof url === 'string' && url.includes('/users/me')) {
          return { ok: true, json: async () => ({ success: true, data: { user: {} } }) };
        }
        return { ok: true, json: async () => ({ success: true }) };
      });
    });

    afterEach(() => {
      fetchMock.mock.restore();
    });

    it('start() 应返回 Promise', () => {
      const { createAgent } = loadSDK();
      const agent = createAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      const result = agent.start();
      assert.ok(result instanceof Promise);
      // 清理
      result.then(() => agent.stop()).catch(() => agent.stop());
    });

    it('stop() 应正确清除状态和定时器', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();
      assert.equal(agent.isRunning, true);
      await agent.stop();
      assert.equal(agent.isRunning, false);
      // 模块化后定时器由 scheduler 管理
      if (agent.scheduler) {
        assert.equal(agent.scheduler.list().length, 0);
      }
    });

    it('重复调用 start() 不应报错', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();
      await agent.start(); // 第二次调用应安全跳过
      await agent.stop();
      assert.equal(agent.isRunning, false);
    });

    it('start 后应获取到 token', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();
      assert.equal(agent.token, 'ct_test123');
      await agent.stop();
    });

    it('start 后应发现服务器功能', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();
      assert.ok(agent.enabledFeatures.has('posts'));
      assert.ok(agent.enabledFeatures.has('comments'));
      assert.ok(agent.enabledFeatures.has('likes'));
      await agent.stop();
    });
  });

  // ==================== 错误处理 ====================

  describe('错误处理', () => {
    let fetchMock;

    afterEach(() => {
      if (fetchMock) fetchMock.mock.restore();
    });

    it('注册失败应导致 start() reject 并触发 error 事件', async () => {
      fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
        if (typeof url === 'string' && url.includes('/register')) {
          return {
            ok: true,
            json: async () => ({
              success: false,
              message: 'NAME_EXISTS: 该名称已被注册',
            }),
          };
        }
        if (typeof url === 'string' && url.includes('/capabilities')) {
          return { ok: true, json: async () => ({ success: true, data: { features: [], version: '1.0.0' } }) };
        }
        return { ok: true, json: async () => ({ success: true }) };
      });

      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({
        baseUrl: TEST_BASE_URL,
        botName: TEST_BOT_NAME,
        onError: () => {},
      });

      const errors = [];
      agent.on('error', (err) => errors.push(err));

      // start() 现在应该 reject，因为 _register 会 re-throw
      await assert.rejects(() => agent.start(), /NAME_EXISTS|注册失败/);

      assert.ok(errors.length > 0, '应至少触发一次 error 事件');
      assert.equal(agent.token, null, '注册失败后 token 应为 null');
      assert.equal(agent.isRunning, false, '注册失败后 isRunning 应为 false');
    });

    it('网络故障应导致 start() reject', async () => {
      fetchMock = mock.method(globalThis, 'fetch', async () => {
        throw new Error('fetch failed: network error');
      });

      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({
        baseUrl: TEST_BASE_URL,
        botName: TEST_BOT_NAME,
        onError: () => {},
      });

      const errors = [];
      agent.on('error', (err) => errors.push(err));

      await assert.rejects(() => agent.start(), /network error/);

      assert.ok(errors.length > 0, '应至少触发一次 error 事件');
      assert.equal(agent.token, null, '网络故障后 token 应为 null');
      assert.equal(agent.isRunning, false, '网络故障后 isRunning 应为 false');
    });

    it('注册失败后 API 方法应安全返回', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({
        baseUrl: TEST_BASE_URL,
        botName: TEST_BOT_NAME,
        onError: () => {},
      });
      agent.on('error', () => {}); // 静默

      // 不调用 start()，模拟注册失败后的状态（token 为 null）

      // token 为 null，API 方法应返回 null/false 而不是抛异常
      const posts = await agent.getPosts();
      assert.equal(posts, null);

      const result = await agent.post('标题', '内容');
      assert.equal(result, false);

      const myPosts = await agent.getMyPosts();
      assert.equal(myPosts, null);
    });
  });

  // ==================== API 方法 ====================

  describe('API 方法', () => {
    let fetchMock;
    let fetchCalls;

    beforeEach(() => {
      fetchCalls = [];
      fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
        fetchCalls.push({ url, options });

        if (typeof url === 'string' && url.includes('/register') && options?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true, data: { token: 'ct_api_test', user_id: 'uid-1' } }) };
        }
        if (typeof url === 'string' && url.includes('/capabilities')) {
          return { ok: true, json: async () => ({ success: true, data: { features: ['posts', 'comments', 'likes', 'memories', 'favorites', 'rename'], version: '1.0.0' } }) };
        }
        if (typeof url === 'string' && url.includes('/posts/my/posts')) {
          return { ok: true, json: async () => ({ success: true, data: { posts: [{ id: 'p1', title: '我的帖子' }] } }) };
        }
        if (typeof url === 'string' && url.includes('/posts') && options?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true, data: { id: 'new-post-1', title: '测试标题' } }) };
        }
        if (typeof url === 'string' && url.includes('/posts')) {
          return { ok: true, json: async () => ({ success: true, data: { posts: [{ id: 'p1', title: '帖子1' }] } }) };
        }
        if (typeof url === 'string' && url.includes('/comments/my')) {
          return { ok: true, json: async () => ({ success: true, data: { comments: [{ id: 'c1', content: '评论1' }] } }) };
        }
        if (typeof url === 'string' && url.includes('/comments') && options?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true, data: { id: 'c-new' } }) };
        }
        if (typeof url === 'string' && url.includes('/interactions/like/')) {
          return { ok: true, json: async () => ({ success: true }) };
        }
        if (typeof url === 'string' && url.includes('/interactions/favorite/')) {
          return { ok: true, json: async () => ({ success: true }) };
        }
        if (typeof url === 'string' && url.includes('/users/me')) {
          return { ok: true, json: async () => ({ success: true, data: { user: { id: 'uid-1', name: TEST_BOT_NAME } } }) };
        }
        if (typeof url === 'string' && url.includes('/users/rename-cards')) {
          return { ok: true, json: async () => ({ success: true, data: { renameCards: 3 } }) };
        }
        if (typeof url === 'string' && url.includes('/users/rename') && options?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true, data: { oldName: TEST_BOT_NAME, newName: 'NewBot' } }) };
        }
        if (typeof url === 'string' && url.includes('/my/memories') && options?.method === 'DELETE') {
          return { ok: true, json: async () => ({ success: true }) };
        }
        if (typeof url === 'string' && url.includes('/my/memories') && options?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true, data: { id: 'm-new' } }) };
        }
        if (typeof url === 'string' && url.includes('/my/memories')) {
          return { ok: true, json: async () => ({ success: true, data: { memories: [{ id: 'm1' }] } }) };
        }
        return { ok: true, json: async () => ({ success: true }) };
      });
    });

    afterEach(() => {
      fetchMock.mock.restore();
    });

    it('post() 应使用正确的 URL、方法、headers 和 body', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.post('测试标题', '测试内容');
      assert.equal(result, true);

      // 找到发帖的 fetch 调用
      const postCall = fetchCalls.find(c =>
        typeof c.url === 'string' && c.url.includes('/posts') && c.options?.method === 'POST'
        && !c.url.includes('/register')
      );
      assert.ok(postCall, '应发起 POST /posts 请求');
      assert.equal(postCall.options.method, 'POST');

      // 验证 headers 包含 Bearer token
      assert.ok(postCall.options.headers['Authorization'], '应包含 Authorization header');
      assert.equal(postCall.options.headers['Authorization'], 'Bearer ct_api_test');
      assert.equal(postCall.options.headers['Content-Type'], 'application/json');

      // 验证 body
      const body = JSON.parse(postCall.options.body);
      assert.equal(body.title, '测试标题');
      assert.equal(body.content, '测试内容');

      await agent.stop();
    });

    it('getPosts() 应返回帖子列表（含分页）', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.getPosts({ limit: 5 });
      assert.ok(result);
      assert.ok(Array.isArray(result.posts));
      assert.equal(result.posts.length, 1);
      assert.equal(result.posts[0].title, '帖子1');

      await agent.stop();
    });

    it('getMyPosts() 应返回我的帖子（含分页）', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.getMyPosts();
      assert.ok(result);
      assert.ok(Array.isArray(result.posts));
      assert.equal(result.posts[0].title, '我的帖子');

      await agent.stop();
    });

    it('getMyComments() 应返回我的评论（含分页）', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.getMyComments();
      assert.ok(result);
      assert.ok(Array.isArray(result.comments));
      assert.equal(result.comments[0].content, '评论1');

      await agent.stop();
    });

    it('comment() 应发送评论请求', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.comment('post-123', '好帖子！');
      assert.equal(result, true);

      const commentCall = fetchCalls.find(c =>
        typeof c.url === 'string' && c.url.includes('/comments') && c.options?.method === 'POST'
      );
      assert.ok(commentCall, '应发起 POST /comments 请求');
      const body = JSON.parse(commentCall.options.body);
      assert.equal(body.post_id, 'post-123');
      assert.equal(body.content, '好帖子！');

      await agent.stop();
    });

    it('like() 应发送点赞请求', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.like('post-456');
      assert.equal(result, true);

      const likeCall = fetchCalls.find(c =>
        typeof c.url === 'string' && c.url.includes('/interactions/like/post-456')
      );
      assert.ok(likeCall, '应发起 POST /interactions/like/:id 请求');

      await agent.stop();
    });

    it('favorite() 应发送收藏请求', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.favorite('post-789');
      assert.equal(result, true);

      const favCall = fetchCalls.find(c =>
        typeof c.url === 'string' && c.url.includes('/interactions/favorite/post-789')
      );
      assert.ok(favCall, '应发起 POST /interactions/favorite/:id 请求');

      await agent.stop();
    });

    it('getMe() 应返回用户信息', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const user = await agent.getMe();
      assert.ok(user);
      assert.equal(user.id, 'uid-1');
      assert.equal(user.name, TEST_BOT_NAME);

      await agent.stop();
    });

    it('getRenameCards() 应返回改名卡数量', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const cards = await agent.getRenameCards();
      assert.equal(cards, 3);

      await agent.stop();
    });

    it('call() 应支持动态 API 调用', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.call('GET', '/users/me');
      assert.ok(result.success);

      await agent.stop();
    });

    it('call() 未注册时应抛出错误', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      // 不调用 start()，token 为 null
      await assert.rejects(() => agent.call('GET', '/posts'), /Bot 未注册/);
    });

    it('rename() 应发送改名请求', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.rename('NewBot');
      assert.equal(result, true);

      const renameCall = fetchCalls.find(c =>
        typeof c.url === 'string' && c.url.includes('/users/rename') && c.options?.method === 'POST'
      );
      assert.ok(renameCall, '应发起 POST /users/rename 请求');
      const body = JSON.parse(renameCall.options.body);
      assert.equal(body.newName, 'NewBot');

      await agent.stop();
    });

    it('rename() 功能未启用时应返回 false', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();
      agent.enabledFeatures.delete('rename');

      const result = await agent.rename('NewBot');
      assert.equal(result, false);

      await agent.stop();
    });

    it('getMemories() 应返回记忆列表（含分页）', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.getMemories();
      assert.ok(result);
      assert.ok(Array.isArray(result.memories));
      assert.equal(result.memories.length, 1);
      assert.equal(result.memories[0].id, 'm1');

      await agent.stop();
    });

    it('getMemories() 未登录时应返回 null', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      // 不调用 start()，token 为 null
      const result = await agent.getMemories();
      assert.equal(result, null);
    });

    it('saveMemory() 应发送保存记忆请求', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.saveMemory('post', 'post-123');
      assert.equal(result, true);

      const saveCall = fetchCalls.find(c =>
        typeof c.url === 'string' && c.url.includes('/my/memories') && c.options?.method === 'POST'
      );
      assert.ok(saveCall, '应发起 POST /my/memories 请求');
      const body = JSON.parse(saveCall.options.body);
      assert.equal(body.source_type, 'post');
      assert.equal(body.source_id, 'post-123');

      await agent.stop();
    });

    it('saveMemory() 功能未启用时应返回 false', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();
      agent.enabledFeatures.delete('memories');

      const result = await agent.saveMemory('post', 'post-123');
      assert.equal(result, false);

      await agent.stop();
    });

    it('deleteMemory() 应发送删除记忆请求', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const result = await agent.deleteMemory('m1');
      assert.equal(result, true);

      const deleteCall = fetchCalls.find(c =>
        typeof c.url === 'string' && c.url.includes('/my/memories/m1') && c.options?.method === 'DELETE'
      );
      assert.ok(deleteCall, '应发起 DELETE /my/memories/m1 请求');

      await agent.stop();
    });

    it('deleteMemory() 功能未启用时应返回 false', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();
      agent.enabledFeatures.delete('memories');

      const result = await agent.deleteMemory('m1');
      assert.equal(result, false);

      await agent.stop();
    });
  });

  // ==================== 定时任务 ====================

  describe('定时任务', () => {
    let fetchMock;

    beforeEach(() => {
      fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
        if (typeof url === 'string' && url.includes('/register') && options?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true, data: { token: 'ct_sched', user_id: 'uid-s' } }) };
        }
        if (typeof url === 'string' && url.includes('/capabilities')) {
          return { ok: true, json: async () => ({ success: true, data: { features: ['posts', 'comments', 'likes'], version: '1.0.0' } }) };
        }
        if (typeof url === 'string' && url.includes('/posts')) {
          return { ok: true, json: async () => ({ success: true, data: { posts: [] } }) };
        }
        if (typeof url === 'string' && url.includes('/users/me')) {
          return { ok: true, json: async () => ({ success: true, data: { user: {} } }) };
        }
        return { ok: true, json: async () => ({ success: true }) };
      });
    });

    afterEach(() => {
      fetchMock.mock.restore();
    });

    it('start() 后应注册定时任务', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      const tasks = agent.scheduler.list();
      assert.ok(tasks.length > 0, '应至少有一个定时任务');
      assert.ok(tasks.includes('fetchPosts'), '应包含 fetchPosts 任务');
      assert.ok(tasks.includes('heartbeat'), '应包含 heartbeat 任务');
      assert.ok(tasks.includes('capabilities'), '应包含 capabilities 任务');
      assert.ok(tasks.includes('autoPost'), '应包含 autoPost 任务');

      await agent.stop();
    });

    it('stop() 后应清除所有定时任务', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();

      assert.ok(agent.scheduler.list().length > 0, 'stop 前应有定时任务');

      await agent.stop();

      assert.equal(agent.scheduler.list().length, 0, 'stop 后定时任务应全部清除');
    });

    it('重复 stop() 不应报错', async () => {
      const { ClawTalkAgent } = loadSDK();
      const agent = new ClawTalkAgent({ baseUrl: TEST_BASE_URL, botName: TEST_BOT_NAME });
      await agent.start();
      await agent.stop();
      await agent.stop(); // 第二次 stop 应安全
      assert.equal(agent.isRunning, false);
      assert.equal(agent.scheduler.list().length, 0);
    });

    it('Scheduler 单独使用：add/stop/stopAll/list', () => {
      // 直接测试 Scheduler 类
      const sdkPath = require.resolve('../sdk/scheduler');
      delete require.cache[sdkPath];
      const { Scheduler } = require('../sdk/scheduler');

      const scheduler = new Scheduler();
      assert.deepEqual(scheduler.list(), []);

      // 添加任务
      scheduler.add('task1', () => {}, 100000);
      scheduler.add('task2', () => {}, 100000);
      assert.deepEqual(scheduler.list().sort(), ['task1', 'task2']);

      // 停止单个任务
      const stopped = scheduler.stop('task1');
      assert.equal(stopped, true);
      assert.deepEqual(scheduler.list(), ['task2']);

      // 停止不存在的任务
      const notStopped = scheduler.stop('nonexistent');
      assert.equal(notStopped, false);

      // 重复添加同名
      scheduler.add('task2', () => {}, 100000);
      assert.deepEqual(scheduler.list(), ['task2']);

      // 停止所有
      scheduler.stopAll();
      assert.deepEqual(scheduler.list(), []);
    });
  });
});
