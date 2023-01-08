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

const { loadPkg } = require('../../pkgs')
const Store = require('./store')
const idGenerator = require('./idGenerator')

const MetaKey = '_meta'
const OrigKey = '_orig'
class Session {
  #idGenerator
  #store
  #ttl

  static VIDHEADER = 'vid'

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
          // console.log('call into _getTTL:')
          let ttl
          if (sess && _.isObject(sess[MetaKey]) && _.isNumber(sess[MetaKey].exp)) {
            const exp = moment.unix(sess[MetaKey].exp)
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
    fastify.addHook('onSend', _.bind(this.#onSend, this))
  }

  #onSend (request, reply, payload, done) {
    // console.log('this=', this)
    // console.log('done=', done)
    const { _ } = global.fastify
    if (!request.session) {
      return done()
    }
    const meta = request.session[MetaKey]
    // console.log('meta=', meta)
    if (!_.isObject(meta) || !meta.id) {
      return done()
    }
    const orig = request.session[OrigKey] || {}
    // console.log('orig=', orig)
    // console.log('request.session=', request.session)
    if (_.isEqual(orig, request.session)) {
      // console.log('equal,return!')
      return done()
    }
    // console.log('not equal,save it!')
    this.#save(meta.id, request.session, done)
  }

  #save (id, session, callback) {
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

  #assignSession (request, meta, initData) {
    const { _ } = global.fastify
    request.session = _.isEmpty(initData) ? {} : _.cloneDeep(initData)
    Object.defineProperty(request.session, MetaKey, {
      enumerable: false,
      configurable: false,
      value: meta
    })
    if (!_.isEmpty(initData)) {
      Object.defineProperty(request.session, OrigKey, {
        enumerable: false,
        configurable: false,
        value: _.cloneDeep(initData)
      })
    }
  }

  async #get (id) {
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

  async $validToken (request, decodedToken) {
    const { s } = global.fastify
    const vid = request.headers[Session.VIDHEADER]
    if (decodedToken.vid) { // 如果要求了vid，但是不想等，则视为无效．
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
    } else {
      meta.ip = request.ip
    }
    // console.log('this.store=', this.#store)
    const initData = await this.#get(meta.id)
    // console.log('initData=', initData)
    this.#assignSession(request, meta, initData)
    decodedToken.session = request.session
    return true
  }

  async ensure (request) {
    if (!request.session) {
      let verified = true
      await request.jwtVerify().catch(e => {
        verified = false
        // console.log('jwtverify error:', e)
      })
      if (!verified) { // 没有创建出session!
        const vid = request.headers[Session.VIDHEADER]
        const meta = {
          id: this.#idGenerator(request)
        }
        if (vid) {
          meta.vid = vid
        } else {
          meta.ip = request.ip
        }
        this.#assignSession(request, meta)
      }
    }
  }

  // string|null 获取当前session的token.并不会设置进入cookie,需要调用者传递给客户端.如未初始化,会自动调用ensure(false)
  async token (request, ttl = null) {
    const fastify = global.fastify
    const { moment } = fastify
    await this.ensure(request)
    const meta = request.session[MetaKey]
    if (!meta.exp) {
      meta.exp = moment().add(ttl || this.#ttl).unix()
    }
    // console.log('meta=', meta)
    const token = await fastify.jwt.sign(meta)
    // console.log('token=', token)
    return token
  }
}

module.exports = Session
