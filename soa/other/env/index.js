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

class Env {
  static inst = null
  static get (fastify, sdl = {}) {
    if (!Env.inst) {
      Env.inst = new Env(fastify, sdl)
    }
    return Env.inst
  }

  constructor (fastify, sdl = {}) {
    const conf = sdl.conf || {}
    this.dev = !!conf.dev
    this.cfg = {
      locale: conf.locale || 'zh-CN'
    }
    this.srvcfg = {
      index: conf.index || 'elastic',
      db: conf.db || 'knex',
      share: conf.share || 'redis',
      fs: conf.fs || 'local',
      static: conf.static || 'local',
      sso: conf.sso || 'passport',
      oss: conf.oss || 'local',
      vault: conf.vault || 'vault'
    }
    if (this.dev) {
      this.srvcfg.deploy = 'docker'
    }
    this.fastify = fastify
  }

  services () {
    const { _ } = this.fastify
    const srvs = _.filter(_.values(this.srvcfg), v => v && v !== 'local')
    // this.fastify.log.debug('valid srvs=%o', srvs)
    return srvs
  }

  get locale () {
    return this.cfg.locale
  }

  get bDev () {
    return this.dev
  }

  get index () {
    return this.srvcfg.index
  }

  get db () {
    return this.srvcfg.db
  }

  get share () {
    return this.srvcfg.share
  }

  get fs () {
    return this.srvcfg.fs
  }

  get static () {
    return this.srvcfg.static
  }

  get vault () {
    return this.srvcfg.vault
  }
}

module.exports.load = function (fastify, sdl) {
  return { inst: Env.get(fastify, sdl) }
}
