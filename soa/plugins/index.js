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

/**
 *
 * @param {String|Array<String>|null} orig 需要检查重复的原始值．
 * @param {Array<String>} hArr 不重复加入的数组．
*/
function appendHeaders (_, orig, hArr) {
  if (!orig) {
    return hArr.join(',')
  }
  let srcArr = []
  if (_.isArray(orig)) {
    srcArr = orig
  } else if (_.isString(orig)) {
    srcArr = orig.split(',')
  }
  for (const header of hArr) {
    if (_.indexOf(srcArr, header) < 0) {
      srcArr.push(header)
    }
  }
  return srcArr.join(',')
}
const ExposeHeaders = ['set-token', 'set-live']
const AllowHeaders = ['authorization', 'content-type', 'vid']
const internal = {
  cors: async (fastify, srvName, sdl) => {
    const { _, log } = fastify
    const pkg = await loadPkg(fastify, '@fastify/cors', false)
    const cfg = _.isObject(sdl.conf) ? _.cloneDeep(sdl.conf) : {}
    if (!cfg.origin) {
      log.warn('未指定cors策略,强制设置为允许全部域名访问.请设置合适的origin')
      cfg.origin = '*'
    }

    cfg.exposedHeaders = appendHeaders(_, cfg.exposedHeaders, ExposeHeaders)
    cfg.allowedHeaders = appendHeaders(_, cfg.allowedHeaders, AllowHeaders)
    // console.log('cfg.credentials=', cfg.credentials)
    // if (!_.has(cfg, 'credentials')) {
    //   cfg.credentials = true
    // }
    // if (!cfg.credentials) { // 如果禁用了credentials,需要明确允许authorization,content-type
    //   cfg.allowedHeaders = cfg.allowedHeaders || ''
    //   const allowedHeaders = 'authorization,content-type,vid'
    //   if (_.isString(cfg.allowedHeaders) && cfg.allowedHeaders) {
    //     cfg.allowedHeaders += allowedHeaders
    //   } else if (_.isArray(cfg.allowedHeaders)) {
    //     cfg.allowedHeaders = _.concat(cfg.allowedHeaders, allowedHeaders.split(','))
    //   } else {
    //     cfg.allowedHeaders = allowedHeaders
    //   }
    // }
    await fastify.register(pkg, cfg)
  },
  'circuit-breaker': '@fastify/circuit-breaker',
  accepts: '@fastify/accepts',
  compress: '@fastify/compress',
  helmet: '@fastify/helmet',
  'rate-limit': '@fastify/rate-limit',
  static: staticPlugin.load,
  cookie: '@fastify/cookie',
  multipart: '@fastify/multipart',
  bree: 'fastify-bree',
  // 'https-redirect': 'fastify-https-redirect',
  formbody: async (fastify, srvName, sdl) => {
    const pkg = await loadPkg(fastify, '@fastify/formbody', false)
    const cfg = fastify._.isObject(sdl.conf) ? fastify._.cloneDeep(sdl.conf) : {}
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
  if (!fastify.runcmd || fastify.runcmd.verbose) {
    fastify.log.info(`启用${packageName}插件,启动参数:%o`, sdl.conf || {})
  }
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
