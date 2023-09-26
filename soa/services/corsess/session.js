/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 8 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: session

let CorsessInst

class Session {
  #initData
  // meta会被签名送往客户端．必定是一个对象，其中id呼应了store中的key.这里除meta外,其它字段是自定义的，整体会被保存进store.
  #meta
  #hasToken

  constructor (meta, initData, hasToken) {
    const { _ } = global.fastify
    this.#meta = meta
    if (!_.isEmpty(initData)) {
      _.assign(this, initData)
      this.#initData = initData
    }
    this.#hasToken = hasToken
  }

  static setInst (inst) {
    CorsessInst = inst
  }

  hasTk () {
    return this.#hasToken
  }

  setTk (has) {
    this.#hasToken = has
  }

  // 使用函数而不是getter，方便omit.
  meta () {
    return this.#meta
  }

  isModified () {
    const { _ } = global.fastify
    return !_.isEqual(this.#initData, _.omit(this, _.isFunction))
  }

  reload (callback) {
    const that = this
    if (callback) {
      CorsessInst.$load(that.id).then(result => {
        for (const r in result) {
          that[r] = result[r]
        }
        callback(null)
      }).catch(err => {
        callback(err)
      })
    } else {
      return CorsessInst.$load(that.id).then(result => {
        for (const r in result) {
          that[r] = result[r]
        }
      })
    }
    // throw new Error('corsession::reload NOT IMPLEMENT')
  }

  // 不完全新建，而是简单清空除meta外的数据.
  // 参考fastify-session的对应实现： https://github.com/fastify/session/blob/master/lib/session.js#L65
  regenerate (keys, callback) {
    if (typeof keys === 'function') {
      callback = keys
      keys = undefined
    }
    const session = this

    for (const r in session) {
      delete session[r]
    }

    if (Array.isArray(keys)) {
      for (const key of keys) {
        session.set(key, this[key])
      }
    }

    return session.save(callback)
  }

  data () {
    return this
  }

  destroy (callback) {
    const that = this
    if (callback) {
      CorsessInst.$destroy(that).then(result => {
        callback(null, result)
      }).catch(err => {
        callback(err)
      })
    } else {
      return CorsessInst.$destroy(that)
    }
  }

  // @TODO:是否重置olddata?
  save (callback) {
    const that = this
    if (callback) {
      CorsessInst.$save(that.#meta.id, that, callback)
    } else {
      return CorsessInst.$save(that.#meta.id, that)
    }
  }

  touch (request, reply, ttl) {
    return CorsessInst.token(request, reply, ttl)
  }

  set (k, v) {
    const { _ } = global.fastify
    if (_.isUndefined(v)) {
      delete this[k]
    } else {
      this[k] = v
    }
  }

  get (k) {
    return this[k]
  }
}

module.exports = Session
