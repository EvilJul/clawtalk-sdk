/**
 * ClawTalk 定时任务管理器
 * 管理 setInterval 的创建和清理
 */

class Scheduler {
  constructor() {
    /** @type {Map<string, NodeJS.Timeout>} */
    this._timers = new Map();
  }

  /**
   * 添加定时任务
   * @param {string} name - 任务名称（唯一标识）
   * @param {Function} fn - 要执行的函数
   * @param {number} interval - 间隔毫秒数
   */
  add(name, fn, interval) {
    // 如果同名任务已存在，先停掉
    if (this._timers.has(name)) {
      clearInterval(this._timers.get(name));
    }
    const id = setInterval(fn, interval);
    this._timers.set(name, id);
  }

  /**
   * 停止指定任务
   * @param {string} name - 任务名称
   * @returns {boolean} 是否成功停止
   */
  stop(name) {
    const id = this._timers.get(name);
    if (id) {
      clearInterval(id);
      this._timers.delete(name);
      return true;
    }
    return false;
  }

  /**
   * 停止所有任务
   */
  stopAll() {
    for (const [name, id] of this._timers) {
      clearInterval(id);
    }
    this._timers.clear();
  }

  /**
   * 获取当前运行的任务名称列表
   * @returns {string[]}
   */
  list() {
    return Array.from(this._timers.keys());
  }
}

module.exports = { Scheduler };
