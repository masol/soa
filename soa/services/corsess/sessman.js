/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 9 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: sessman

const { loadPkg } = require('../../pkgs')
const Store = require('./store')
const idGenerator = require('./idGenerator')
const Session = require('./session')

const VidHeader = 'vid'
const TokenHeader = 'set-token'

class SessMan {
  #idGenerator
  #store
  #ttl
  #strict // 只有严格模式下，在没有vid时，才会自动添加ip.

  constructor (opt = {}) {
    const { _ } = global.fastify
    if (_.isFunction(opt.idGenerator)) {
      this.#idGenerator = opt.idGenerator
    } else {
      this.#idGenerator = idGenerator(true)
    }
    if (_.isObject(opt.ttl) && !_.isEmpty(opt.ttl)) {
      this.#ttl = opt.ttl
    } else {
      this.#ttl = { days: 1 }
    }
    this.#strict = !!opt.strict
  }

  async init (fastify) {
    const { soa, log, _, moment } = fastify
    const env = await soa.get('env')
    if (env.kv === 'redis') {
      const connectRedis = await loadPkg(fastify, 'connect-redis', true)
      const RedisStore = connectRedis.default({
        Store
      })
      // console.log('RedisStore=', RedisStore)
      const redisClient = await soa.get('redis')
      // console.log('session store采用redis...%o', redisClient)
      if (redisClient) {
        this.#store = new RedisStore({ client: redisClient })
        this.#store._getTTL = (sess) => {
          console.log('call into _getTTL:')
          let ttl
          const meta = sess.meta()
          if (sess && _.isObject(meta) && _.isNumber(meta.exp)) {
            const exp = moment.unix(meta.exp)
            const now = moment()
            ttl = Math.ceil(moment.duration(exp.diff(now)).asSeconds())
            // console.log('ttl=', ttl)
          } else {
            ttl = 86400
          }
          return ttl
        }
      } else {
        const msg = '为session启用redis store时出错:无法获取redis服务对象。退化到内存存储。'
        log.error(msg)
        throw new Error(msg)
      }
    }
    if (!this.#store) {
      throw new Error('corsess:未能初始化store!')
    }
    Session.setInst(this)
    fastify.decorate('sessionStore', this.#store)
    fastify.addHook('onRequest', _.bind(this.#onRequest, this))
    fastify.addHook('onSend', _.bind(this.#onSend, this))
  }

  async #onRequest (request, reply) {
    await this.ensure(request)
  }

  async #onSend (request, reply, payload) {
    // console.log('this=', this)
    // console.log('done=', done)
    const { _ } = global.fastify
    if (!request.session) {
      return
    }
    const meta = request.session.meta()
    // console.log('meta=', meta)
    if (!_.isObject(meta) || !meta.id) {
      return
    }
    if (!request.session.isModified()) {
      // console.log('equal,return!')
      return
    }
    // console.log('not equal,save it!')
    if (!request.session.hasTk()) {
      // console.log('set token!!')
      await this.token(request, reply)
    }
    await this.$save(meta.id, request.session)
  }

  $save (id, session, callback) {
    if (callback) {
      this.#store.set(id, session, error => {
        callback(error)
      })
    } else {
      return new Promise((resolve, reject) => {
        this.#store.set(id, session, error => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
    }
  }

  async verify (request) {
    if (request.session) {
      return
    }
    await request.jwtVerify()
  }

  #assignSession (request, meta, initData, hasToken) {
    request.session = new Session(meta, initData, hasToken)
    // const { _ } = global.fastify
    // request.session = _.isEmpty(initData) ? {} : _.cloneDeep(initData)
    // Object.defineProperty(request.session, MetaKey, {
    //   enumerable: false,
    //   configurable: false,
    //   value: meta
    // })
    // Object.defineProperty(request.session, 'set', {
    //   enumerable: false,
    //   configurable: false,
    //   value: (k, v) => {
    //     if (_.isUndefined(v)) {
    //       delete request.session[k]
    //     } else {
    //       request.session[k] = v
    //     }
    //   }
    // })
    // Object.defineProperty(request.session, 'get', {
    //   enumerable: false,
    //   configurable: false,
    //   value: (k) => {
    //     return request.session[k]
    //   }
    // })
    // if (!_.isEmpty(initData)) {
    //   Object.defineProperty(request.session, OrigKey, {
    //     enumerable: false,
    //     configurable: false,
    //     value: _.cloneDeep(initData)
    //   })
    // }
  }

  async #load (id) {
    const that = this
    return new Promise((resolve, reject) => {
      that.#store.get(id, (err, session) => {
        if (err) {
          if (err.code === 'ENOENT') {
            resolve({})
          } else {
            reject(err)
          }
        } else {
          resolve(session || {})
        }
      })
    })
  }

  async #destroy (id) {
    const that = this
    return new Promise((resolve, reject) => {
      that.#store.destroy(id, (err) => {
        if (err) {
          if (err.code === 'ENOENT') {
            resolve(true)
          } else {
            reject(err)
          }
        } else {
          resolve(true)
        }
      })
    })
  }

  async $destroy (sess) {
    const meta = sess.meta()
    if (meta.id) {
      return this.#destroy(meta.id)
    }
  }

  async $validToken (request, decodedToken) {
    const { s } = global.fastify
    const vid = request.headers[VidHeader]
    // console.log('decodedToken=', decodedToken)
    if (decodedToken.vid) { // 如果要求了vid，但是不相等，则视为无效．
      if (s.trim(vid) !== s.trim(decodedToken.vid)) {
        return false
      }
    } else if (decodedToken.ip) { // 没有vid,但是有ip,则验证之．
      // @TODO: 是否启用[node-ip](https://github.com/indutny/node-ip)来执行subnet计算？
      if (decodedToken.ip !== request.ip) {
        return false
      }
    }
    const meta = {
      id: decodedToken.id
    }
    if (vid) {
      meta.vid = vid
    } else if (this.#strict) {
      meta.ip = request.ip
    }
    // console.log('this.store=', this.#store)
    const initData = await this.#load(meta.id)
    // console.log('initData=', initData)
    this.#assignSession(request, meta, initData, true)
    decodedToken.session = request.session
    return true
  }

  async ensure (request) {
    // console.log('request.session=', request.session)
    if (!request.session) {
      let verified = true
      await request.jwtVerify().catch(e => {
        verified = false
        // console.log('jwtverify error:', e)
      })
      // console.log('verified=', verified)
      if (!verified) { // 没有创建出session!
        const vid = request.headers[VidHeader]
        const meta = {
          id: this.#idGenerator(request)
        }
        if (vid) {
          meta.vid = vid
        } else {
          meta.ip = request.ip
        }
        this.#assignSession(request, meta, undefined, false)
      }
    }
  }

  // string|null 获取当前session的token.并不会设置进入cookie,需要调用者传递给客户端.如未初始化,会自动调用ensure(false)
  async token (request, reply = null, ttl = null) {
    const fastify = global.fastify
    const { moment, _ } = fastify
    await this.ensure(request)
    const meta = request.session.meta() || {}
    if (!meta.exp) {
      if (ttl) {
        if (_.isNumber(ttl)) {
          meta.exp = moment().add(ttl, 'seconds').unix()
        } else {
          meta.exp = moment().add(ttl).unix()
        }
      } else {
        meta.exp = moment().add(this.#ttl).unix()
      }
    }
    // console.log('meta=', meta)
    const token = await fastify.jwt.sign(meta)
    if (reply) {
      if (!request.session.isModified()) {
        // 强制保存一次，以刷新redis的ttl.
        await request.session.save()
      }
      reply.header(TokenHeader, encodeURI(token))
    }
    // console.log('token=', token)
    return token
  }
}

module.exports = SessMan
