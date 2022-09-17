/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 6 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: index

const { loadPkg } = require('../pkgs')
const staticPlugin = require('./static')
// const sessionPlugin = require('./session')
// const socketioPlugin = require('./socketio')

const internal = {
  cors: '@fastify/cors',
  'circuit-breaker': '@fastify/circuit-breaker',
  accepts: '@fastify/accepts',
  compress: '@fastify/compress',
  'rate-limit': '@fastify/rate-limit',
  static: staticPlugin.load,
  cookie: '@fastify/cookie',
  multipart: '@fastify/multipart',
  bree: 'fastify-bree',
  // 'https-redirect': 'fastify-https-redirect',
  formbody: async (fastify, srvName, sdl) => {
    const pkg = await loadPkg(fastify, '@fastify/formbody', false)
    const cfg = fastify._.isObject(sdl.conf) ? fastify._.clone(sdl.conf) : {}
    if (!cfg.parser) {
      const qs = require('qs')
      cfg.parser = str => qs.parse(str)
    }
    cfg.bodyLimit = cfg.bodyLimit || 10240
    await fastify.register(pkg, cfg)
  },
  // multer: true,
  session: true,
  socketio: true,
  passport: true
}

async function loadPlugin (fastify, packageName, sdl = {}) {
  const pkg = await loadPkg(fastify, packageName, false)
  await fastify.register(pkg, sdl.conf)
  // https://github.com/pinojs/pino/blob/master/docs/api.md#message
  fastify.log.info(`启用${packageName}插件,启动参数:%o`, sdl.conf || {})
  return pkg
}

async function load (fastify, srvName, sdl = {}) {
  const { _, log } = fastify
  const handler = internal[srvName]
  // console.log(srvName, 'sdl in plugin/index:', sdl)
  if (_.isFunction(handler)) {
    return await handler(fastify, srvName, sdl)
  } else if (_.isString(handler)) {
    return { inst: await loadPlugin(fastify, handler, sdl) }
  } else if (handler) {
    try {
      const Handler = require(`./${srvName}`)
      // console.log('Handler=', Handler)
      if (Handler && _.isFunction(Handler.load)) {
        return await Handler.load(fastify, srvName, sdl)
      }
    } catch (e) {
      console.log('load error:', e)
    }
  }
  log.warn('请求的插件%s不存在或无法加载。', srvName)
  return { inst: null }
}

function has (srvName) {
  return !!internal[srvName]
}

module.exports.load = load
module.exports.has = has
