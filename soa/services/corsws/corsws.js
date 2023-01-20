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

// 对应一个socket的ctx.
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

  // @msg format see https://github.com/mcollina/mqemitter-redis#example
  static emit (msg) {
    return new Promise((resolve) => {
      // console.log('emit msg=', msg)
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
    // console.log('redis.conf', redis.conf)
  }

  async #doTrans (tkCtx, payload) {
    if (tkCtx.trans) {
      console.error('个性化过滤尚未实现!')
    }
    return payload
  }

  // 接收到内部emit通知事件之后的处理，不再保存targetSocket, topicToken,而是将其当作参数传递下来．
  async #onEmitted (targetSocket, tkCtx, message, cb) {
    // console.log('onEmitted topicToken=', tkCtx)
    // console.log('onEmitted topic=', message.topic)
    // console.log('onEmitted  payload=', message.payload)
    const payload = await this.#doTrans(tkCtx, JSON.parse(message.payload))
    targetSocket.send(JSON.stringify({
      op: 'live',
      topic: tkCtx.tkHash,
      payload
    }))
    cb()
  }

  hasAdd (topic) {
    return this.#topics[topic]
  }

  async add (liveObj, socket) {
    // console.log('add liveObj:', liveObj)
    if (this.hasAdd(liveObj.topic)) {
      // console.log('already added')
      return false
    }
    const { _, soa, log } = global.fastify
    const topic = liveObj.topic
    // const last = addObj.last || 0
    let handler = this.#topics[topic]
    if (!handler) {
      // console.log('begin adding...')
      handler = _.bind(this.#onEmitted, this, socket, liveObj) // 需要deepClone,防止其它环节修改liveObj?
      this.#topics[topic] = handler
      if (!this.#topics[AllTopic]) {
        await this.add({ topic: AllTopic, tkHash: null }, socket)
      }
      // console.log('added on topic:', topic)
      SockCtx.#mqemitter.on(topic, handler)
      // 开始回应last,如果有的话．(诸如all这样的通路是不记录的，只有实时信息，错过的会丢弃)
      if (_.isNumber(liveObj.last)) {
        const ojs = await soa.get('objection')
        const Push = ojs.Model.store.push
        if (!Push) {
          log.error('未注册Live记录表!')
        } else {
          const emitLast = await Push.query().select('*').modify('topic', { topic, last: liveObj.last })
          // const result = await Push.query().select('*').modify('topic', { topic, last: addObj.last })
          // console.log('send result to socket!!=', result)
          // 开始检查并处理last.
          // console.log('emitLast=', emitLast)
          // 有消息需要发送．
          if (emitLast.length > 0) {
            const topic = liveObj.topic
            setImmediate(() => {
              SockCtx.emit({
                topic,
                payload: JSON.stringify(emitLast)
              })
            })
          }
        }
      }
      return true
    }
    return false
  }

  rm (rmObj) {
    const topic = rmObj.topic
    // console.log('this.#topics=', this.#topics)
    const handler = this.#topics[topic]
    if (handler) {
      delete this.#topics[topic]
      // console.log('remove topic:', topic)
      SockCtx.#mqemitter.removeListener(topic, handler)
    }
  }

  rmAll (fastify) {
    const { _ } = fastify
    _.each(this.#topics, (handler, topic) => {
      // console.log('remove topic:', topic)
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
    const { error, _ } = fastify
    if (!SockCtx.inited) {
      await SockCtx.$init(fastify)
    }
    const that = CorsWS.inst
    that.connections.add(connection)

    // 从req.url中获取token,last信息．
    let token = req.query.topic
    const last = parseInt(req.query.last) || -1
    let timerId
    // console.log('req.query=', req.query)
    // console.log('token=', token)
    connection.socket.ctx = connection.socket.ctx || new SockCtx()

    const socket = connection.socket
    const ctx = socket.ctx

    if (token) {
      const tkObj = fastify.jwt.decode(token)
      // console.log('tkObj=', tkObj)
      if (!tkObj.topic) {
        token = undefined
      } else {
        if (last >= 0) {
          tkObj.last = last
        }
        tkObj.tkHash = _.simpleHash(token)
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
    connection.socket.on('message', async message => {
      const { log, jwt } = fastify
      try {
        const pkg = JSON.parse(message)
        console.log('recieved pkg=', pkg)
        switch (pkg.op) {
          case 'live': // 建立一个live通路．
            {
              const liveObj = jwt.decode(pkg.msg.topic)
              liveObj.tkHash = _.simpleHash(pkg.msg.topic)
              if (!liveObj.topic) { // token中未包含topic.忽略此消息．
                log.error('接收到未包含topic的live请求,忽略请求．')
                return
              }
              // console.log('liveObj=', liveObj)
              if (timerId) {
                clearTimeout(timerId)
                timerId = undefined
              }
              ctx.add(liveObj, socket)
            }
            break
          case 'rm': // 关闭一个live通路．
            {
              console.log('pkg.msg.topic=', pkg.msg.topic)
              const rmObj = jwt.decode(pkg.msg.topic)
              if (!rmObj.topic) { // token中未包含topic.忽略此消息．
                log.error('接收到未包含topic的rm请求,忽略请求．')
                return
              }
              // console.error('not implement remove live: rmObj=', rmObj)
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
      return ctx.rmAll(fastify)
    })

    // console.log('request.session=', req.session)
  }

  async #updateLast (topic, payload, volatile) {
    let last = -1
    if (!volatile) { // 不保存至数据库．
      const { soa, log } = global.fastify
      const ojs = await soa.get('objection')
      const Push = ojs.Model.store.push
      if (!Push) {
        log.error('未注册Push表')
      } else {
        const result = await Push.query().insert({
          topic,
          message: JSON.stringify(payload)
        })
        last = result.id
      }
    } else {
      last = -2 // volatile msg
    }
    return last
  }

  /**
   * 通知所有关注人，主题对应资源发生变更．在发生变更处调用即可．
   * @param {string} topic 通知主题．
   * @param {Object} payload 通知内容，参考diff.
   * @param {boolean} volatile =true则不保存历史记录，默认保存
   */
  async update (topic, payload, volatile = false) {
    const { _, error } = global.fastify
    if (!_.isObject(payload) || !topic) {
      throw new error.PreconditionRequiredError('payload must be object and topic must has value.')
    }
    const last = await this.#updateLast(topic, payload, volatile)
    payload.last = last
    SockCtx.emit({
      topic,
      payload: JSON.stringify(payload)
    })
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
      last = await this.#last(topic)
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

  // 获取全部晚于last的topic
  async #afterLast (topic, last) {
    let ret = []
    const { soa } = global.fastify
    const ojs = await soa.get('objection')
    const Push = ojs.Model.store.push
    if (Push) {
      ret = await Push.query().select('*').modify('after', topic, last)
    }
    return ret
  }

  async #last (topic) {
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
