/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 16 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: corsws

const AllTopic = 'all'
const LiveHeader = 'set-live'

class SockCtx {
  static #mqemitter
  #topics
  // #createdAt // 创建时间(最后一次活跃时间，用于idle时间检查)
  constructor () {
    // const { moment } = global.fastify
    this.#topics = {}
    // this.#createdAt = moment()
  }

  static get inited () {
    return !!SockCtx.#mqemitter
  }

  static emit (msg) {
    return new Promise((resolve) => {
      SockCtx.#mqemitter.emit(msg, resolve)
    })
  }

  static async $init (fastify) {
    const { soa, _ } = fastify
    const redis = await soa.get('redis')
    const redisEmitter = require('mqemitter-redis')
    const conf = _.cloneDeep(redis.conf)
    if (!conf.db) { // 使用不同于默认redis的db.
      conf.db = 1
    } else {
      conf.db++
    }
    SockCtx.#mqemitter = redisEmitter(conf)
    console.log('redis.conf', redis.conf)
  }

  async add (addObj, socket) {
    const { _, soa, log } = global.fastify
    const topic = addObj.topic
    // const last = addObj.last || 0
    let handler = this.#topics[topic]
    if (!handler) {
      if (!this.#topics[AllTopic]) {
        await this.add({ topic: AllTopic }, socket)
      }
      handler = _.bind(socket.send, socket)
      this.#topics[topic] = handler
      SockCtx.#mqemitter.on(topic, handler)
      // 开始回应last,如果有的话．(诸如all这样的通路是不记录的，只有实时信息，错过的会丢弃)
      if (_.isNumber(addObj.last)) {
        const ojs = await soa.get('objection')
        const Push = ojs.Model.store.push
        if (!Push) {
          log.error('未注册Live记录表!')
        } else {
          const result = await Push.query().select('*').modify('topic', { topic, last: addObj.last })
          console.log('send result to socket!!=', result)
        }
      }
    }
  }

  rm (rmObj) {
    const topic = rmObj.topic
    const handler = this.#topics[topic]
    if (handler) {
      delete this.#topics[topic]
      SockCtx.#mqemitter.removeListener(topic, handler)
    }
  }

  rmAll (fastify) {
    const { _ } = fastify
    _.each(this.#topics, (handler, topic) => {
      SockCtx.#mqemitter.removeListener(topic, handler)
    })
    this.#topics = {}
  }
}

class CorsWS {
  #connections // WeakMap({connection,ctx})
  idle // 默认的idle时间．
  constructor () {
    this.#connections = new WeakSet()
    this.idle = 0
  }

  get connections () {
    return this.#connections
  }

  static #inst
  static get inst () {
    if (!CorsWS.#inst) {
      CorsWS.#inst = new CorsWS()
    }
    return CorsWS.#inst
  }

  static async handler (connection /* SocketStream */, req /* FastifyRequest */) {
    const fastify = global.fastify
    const { error } = fastify
    if (!SockCtx.inited) {
      await SockCtx.$init(fastify)
    }
    const that = CorsWS.inst
    that.connections.add(connection)
    let token, timerId, last
    if (req.headers && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ')
      if (parts.length === 2) {
        const scheme = parts[0]
        if (/^-?\d+$/i.test(scheme)) {
          token = parts[1]
          last = parseInt(scheme)
        }
      }
    }
    connection.socket.ctx = connection.socket.ctx || new SockCtx()

    const socket = connection.socket
    const ctx = socket.ctx

    if (token) {
      const tkObj = fastify.jwt.decode(token)
      if (!tkObj.topic) {
        token = undefined
      } else {
        if (last >= 0) {
          tkObj.last = last
        }
        ctx.add(tkObj, socket)
      }
    }
    if (!token) {
      const brokeConn = () => {
        const err = new error.UnauthorizedError('idle timeout')
        connection.destroy(err)
        throw err
      }
      if (that.idle > 10) {
        timerId = setTimeout(brokeConn, that.idle)
      } else {
        brokeConn()
      }
    }
    connection.socket.on('message', message => {
      const { log, jwt } = fastify
      try {
        const msg = JSON.parse(message)
        switch (msg.op) {
          case 'add': // 建立一个live通路．
            {
              const addObj = jwt.decode(msg.topic)
              console.log('addObj=', addObj)
              if (timerId) {
                clearTimeout(timerId)
                timerId = undefined
              }
              ctx.add(addObj, socket)
            }
            break
          case 'rm': // 关闭一个live通路．
            {
              const rmObj = jwt.decode(msg.topic)
              console.log('rmObj=', rmObj)
              ctx.rm(rmObj, socket)
            }
            break
        }
      } catch (e) {
        log.error('corsWS接收到非法消息:%s', String(e))
      }
    })
    connection.socket.on('close', (evt) => {
      const ctx = socket.ctx
      delete socket.ctx
      console.log('socket close event!')
      return ctx.rmAll()
    })

    // console.log('request.session=', req.session)
  }

  async emit (msg) {
    let last = -1
    if (!msg.volatile) { // 不保存至数据库．
      const { soa, log } = global.fastify
      const ojs = await soa.get('objection')
      const Push = ojs.Model.store.push
      if (!Push) {
        log.error('未注册Push表')
      } else {
        const result = await Push.query().insert({
          topic: msg.topic,
          message: JSON.stringify(msg.message)
        })
        last = result.id
      }
      SockCtx.emit(msg)
    } else {
      last = -2 // volatile msg
    }
    return last
  }

  /**
   * 获取topic对应的liveId,以当前数据库中的内容为last.
   * @param {String} qpl batch下的Query String(ctx.__currentQuery),restful请求，直接传空''即可．
   * @param {String} topic
   * @param {FAstifyReply} [reply=null]
   * @param {Interge} last 当前缓冲的最后id.如果是volatile(忽略缓冲),设置为-2即可．不传值自动获取当前主题的last.
   * @returns 新增加的liveTk,如果为空，未增加live.
   */
  async setLive (qpl, topic, reply, last) {
    const { _ } = global.fastify
    if (!topic) return ''
    const fastify = global.fastify
    // const last = await this.last(topic)
    if (!fastify._.isNumber(last)) {
      last = await this.last(topic)
    }
    const tkObj = { topic }
    // 有效的jwt字符集: [a-zA-Z0-9-_.]+  @see https://jwt.io/introduction/
    const token = fastify.jwt.sign(tkObj)
    // console.log('last=', last)
    const qHash = qpl && _.isString(qpl) ? _.simpleHash(qpl.replaceAll(/[\n\r\s,"]/ig, '')) : '0'
    // lives之间通过逗号(,)分割，qhash,last,token之间通过美元符号($)分割．有效的uri字符集，无效的jwt字符集．
    const liveTk = `${qHash}$${last}$${token}`
    if (reply) {
      const oldlive = reply.getHeader(LiveHeader)
      const newLive = oldlive ? `${oldlive},${liveTk}` : liveTk
      reply.header(LiveHeader, newLive)
    }
    return liveTk
  }

  async last (topic) {
    let last = -1
    const { soa } = global.fastify
    const ojs = await soa.get('objection')
    const Push = ojs.Model.store.push
    if (Push) {
      const result = await Push.query().select('*').modify('last', topic)
      if (result.length > 0) {
        last = result[0].id
      }
    }
    return last
  }
}

module.exports = CorsWS
