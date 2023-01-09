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
