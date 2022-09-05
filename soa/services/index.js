/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 5 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: tpl

const env = require('./env')

const intPlugins = {
  cors: '@fastify/cors',
  'circuit-breaker': '@fastify/circuit-breaker',
  accepts: '@fastify/accepts',
  compress: '@fastify/compress',
  'rate-limit': '@fastify/rate-limit'
}

const intPackages = {
  cryptoRandom: {
    pkg: 'crypto-random-string',
    module: true
  }
}

const intServices = {
  docker: true,
  static: true,
  elastic: true,
  vault: true
}

async function loadPkg (fastify, pkgName, isES6) {
  if (isES6) {
    // fastify.log.debug('load package %s...', pkgName)
    const module = await fastify.shell.import(pkgName)
    // fastify.log.debug('load package %s to %o', pkgName, module)
    if (module) {
      return module.default ? module.default : module
    }
  }
  return await fastify.shell.require(pkgName)
}

async function loadPlugin (fastify, packageName, sdl = {}) {
  const pkg = await loadPkg(fastify, packageName, false)
  fastify.register(pkg, sdl.conf)
  // https://github.com/pinojs/pino/blob/master/docs/api.md#message
  fastify.log.info(`启用${packageName}插件,启动参数:%o`, sdl.conf || {})
  return pkg
}

async function load (fastify, srvName, sdl = {}) {
  switch (srvName) {
    case 'fastify':
      return { inst: fastify }
    case 'env':
      return env.load(fastify, sdl)
    default:
      if (intPlugins[srvName]) {
        // const mload = fastify.$.memoize(loadPlugin, (_, name) => name)
        return { inst: await loadPlugin(fastify, intPlugins[srvName], sdl) }
      } else {
        const pkgInfo = intPackages[srvName]
        // fastify.log.debug('pkgInfo=%o', pkgInfo)
        if (pkgInfo) {
          return { inst: await loadPkg(fastify, pkgInfo.pkg, pkgInfo.module) }
        } else if (intServices[srvName]) {
          try {
            const service = require(`./${srvName}`)
            if (service && fastify._.isFunction(service.load)) {
              fastify.log.info('加载%s服务,启动参数:%o', srvName, sdl)
              return await service.load(fastify, sdl)
            }
          } catch (e) {
            fastify.log.error('获取默认服务%s时发生错误:%s', srvName, e)
          }
        }
      }
  }
}

module.exports.load = load
