/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 6 Nov 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: cache

const LRU = require('lru-cache')

class Cache {
  #cache
  constructor (opts) {
    opts = opts || {
      max: 500,
      maxSize: 5 * 1024,
      sizeCalculation: (value, key) => 1,
      ttl: 1000 * 60 * 60, // 1 hour
      allowStale: false, // return stale items before removing from cache?
      updateAgeOnGet: true,
      updateAgeOnHas: true
    }
    const optDispose = opts.dispose
    opts.dispose = (value, key) => {
      // 这里清理依赖key的所有key(类别)
      if (optDispose) {
        return optDispose(value, key)
      }
    }
    this.#cache = new LRU(opts)
  }

  // key是对象，需要解析为fsm+id的格式。通过fsm可以获取其依赖信息。
  // 通过value来检查依赖信息。
  get (key) {
    const value = this.#cache.get(key)
    if (value) { // 开始执行依赖检查。
    }
    // return value
    // 在缓冲实现之前，返回null
    return null
  }

  // 初始化cache子系统。建立redis的pub/sub通路。
  async init (fastify) {
  }
}

module.exports = Cache
