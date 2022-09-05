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
  static get (fastify) {
    if (!Env.inst) {
      Env.inst = new Env(fastify)
    }
    return Env.inst
  }

  constructor (fastify, sdl = {}) {
    this.local = !!sdl.local
    this.srvcfg = {
      deploy: sdl.deploy || 'docker',
      index: sdl.index || 'elastic',
      db: sdl.db || 'postgres',
      cache: sdl.cache || 'redis',
      fs: sdl.fs || 'local',
      static: sdl.static || 'local',
      secure: sdl.secure || false
    }
    if (this.local) {
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

  get bLocal () {
    return this.srvcfg.local
  }

  get deploy () {
    return this.srvcfg.deploy
  }

  get index () {
    return this.srvcfg.index
  }

  get db () {
    return this.srvcfg.db
  }

  get cache () {
    return this.srvcfg.cache
  }

  get fs () {
    return this.srvcfg.fs
  }

  get static () {
    return this.srvcfg.static
  }
}

module.exports.load = function (fastify, sdl) {
  return { inst: Env.get(fastify, sdl) }
}
