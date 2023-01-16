/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 4 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: index

const DefFrameWork = {
  ftxt: 'elastic', // full-text search service. 'solr','zinc'...
  db: 'knex',
  kv: 'redis',
  res: false, // 资源存储服务(suoss: sign url oss)
  sess: 'corsess', // session.
  sso: 'passport', // 'keycloak'
  push: 'corsws', // 'uwebsocket','socketio' //corws基于@fastify/websocket和mqemitter-redis.基于BO的对资源命名规则来实现．
  media: false, // 'nms'[node-media-server](https://www.npmjs.com/package/node-media-server),'plex','[medooze](https://github.com/medooze/media-server-node)'
  predic: false, // 'mindsdb','mldb','xgboost' //预测服务.基于数据训练或prolog或人工编制的规则．形成virtual table/field的概念．
  // dqm: 'bullmq', // 'bee(https://github.com/bee-queue/bee-queue)','celery(https://docs.celeryq.dev/en/stable/)'  Distributed Queue Management
  p2p: false, // libp2p, webrtc, swarm,tor,bittorrent //p2p存储(区块链).私有可控通过fuse以文件系统方式访问．
  vault: 'vault'// 根据vault issue来判定其发行者.默认是local.see vault service.
}

class Env {
  static #inst = null
  #cfg // 保存了配置信息,例如locale.
  #srvcfg // 保存了服务框架选择.
  static get (fastify, sdl = {}) {
    if (!Env.#inst) {
      Env.#inst = new Env(fastify, sdl)
    }
    return Env.#inst
  }

  constructor (fastify, sdl = {}) {
    const { _ } = fastify
    const conf = sdl.conf || {}
    this.#cfg = {
      locale: conf.locale || 'zh-CN'
    }
    this.#srvcfg = _.assign(_.clone(DefFrameWork),
      _.pick(conf, _.keys(DefFrameWork)))
    this.fastify = fastify
  }

  services () {
    const { _ } = this.fastify
    const srvs = _.filter(_.values(this.#srvcfg), v => v && v !== 'local' && v !== 'false')
    this.fastify.log.debug('valid srvs=%o', srvs)
    return srvs
  }

  /**
   * 获取指定类别下的服务．
   * @param {string} cateName 类别名称只能是DefFrameWork中的一个．
   * @returns 服务实例或null
   */
  async srv (cateName) {
    const { soa } = this.fastify
    const srvName = this.#srvcfg[cateName]
    if (!srvName || srvName === 'local' || srvName === 'false') {
      return null
    }
    return await soa.get()
  }

  isDev () {
    const { s } = this.fastify
    // console.log('clusterName=', clusterName)
    return s.clusterName === 'dev'
  }

  get locale () {
    return this.#cfg.locale
  }

  get sess () {
    return this.#srvcfg.sess
  }

  get ftxt () {
    return this.#srvcfg.ftxt
  }

  get db () {
    return this.#srvcfg.db
  }

  get kv () {
    return this.#srvcfg.kv
  }

  get res () {
    return this.#srvcfg.res
  }

  get vault () {
    return this.#srvcfg.vault
  }
}

module.exports.load = function (fastify, sdl) {
  return { inst: Env.get(fastify, sdl) }
}
