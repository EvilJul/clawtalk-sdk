/**
 * ClawTalk HTTP 客户端
 * 封装 fetch 调用，支持指数退避重试，统一错误处理
 */

class ClawTalkClient {
  /**
   * @param {string} baseUrl - API 基础 URL
   * @param {Object} [options]
   * @param {number} [options.maxRetries=3] - 最大重试次数
   * @param {number} [options.initialDelay=1000] - 初始重试延迟（毫秒）
   * @param {number} [options.timeout=15000] - 请求超时（毫秒）
   */
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialDelay = options.initialDelay ?? 1000;
    this.timeout = options.timeout ?? 15000;
    this.token = null;
  }

  /**
   * 设置认证 token
   * @param {string} token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * 判断是否为可重试的错误（网络错误，非 4xx）
   * @param {Error} error
   * @returns {boolean}
   * @private
   */
  _isRetryable(error) {
    // fetch 网络错误没有 status，直接重试
    if (!error.status) return true;
    // 429 限流可重试
    if (error.status === 429) return true;
    // 5xx 服务端错误可重试
    if (error.status >= 500) return true;
    // 4xx 客户端错误不重试
    return false;
  }

  /**
   * 延迟指定毫秒
   * @param {number} ms
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 发起带重试的请求
   * @param {string} endpoint - API 端点（相对路径）
   * @param {Object} [options] - fetch 选项
   * @returns {Promise<Object>} 解析后的 JSON 响应
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const fetchOptions = {
      ...options,
      headers,
    };

    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // 请求超时控制
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        const response = await fetch(url, { ...fetchOptions, signal: controller.signal }).finally(() => clearTimeout(timer));

        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
          err.status = response.status;
          err.retryAfter = response.headers.get('Retry-After');
          // 尝试解析响应体
          try { err.body = await response.json(); } catch (_) {}
          throw err;
        }

        return await response.json();
      } catch (error) {
        lastError = error;

        // 4xx 不重试，直接抛出
        if (!this._isRetryable(error)) {
          throw error;
        }

        // 最后一次尝试不再等待
        if (attempt < this.maxRetries) {
          let delay;
          // 429 优先使用 Retry-After 头
          if (error.status === 429 && error.retryAfter) {
            const seconds = Number(error.retryAfter);
            delay = (Number.isFinite(seconds) ? seconds : 60) * 1000;
          } else {
            delay = this.initialDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
          }
          await this._sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * GET 请求
   * @param {string} endpoint
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST 请求
   * @param {string} endpoint
   * @param {Object} [body]
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE 请求
   * @param {string} endpoint
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

module.exports = { ClawTalkClient };
