/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 11 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: socketio
module.exports.load = async function (fastify, srvName, sdl = {}) {
  const { soa, log, _ } = fastify
  const { loadPkg } = require('../pkgs')
  const fastifyIO = await loadPkg(fastify, 'fastify-socket.io', false)
  const ioCfg = _.isObject(sdl.conf) ? _.clone(sdl.conf) : {}
  if (!ioCfg.adapter) {
  // @fixme: support adapter config.
  // const adpCfg = _.isObject(sdl.adapter) ? _.clone(sdl.adapter) : {}
    const adapters = await loadPkg(fastify, '@socket.io/redis-adapter', false)
    const redis = await soa.get('redis')
    const pubClient = redis.duplicate()
    const subClient = redis.duplicate()
    ioCfg.adapter = adapters.createAdapter(pubClient, subClient)
  }
  await fastify.register(fastifyIO, sdl.conf)
  log.debug('socketio loaded!')
  return { inst: fastifyIO }
}
