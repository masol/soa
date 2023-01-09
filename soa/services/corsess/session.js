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
    throw new Error('corsession::reload NOT IMPLEMENT')
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
