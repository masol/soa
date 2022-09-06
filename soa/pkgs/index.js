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

const internal = {
  cryptoRandom: {
    pkg: 'crypto-random-string',
    module: true
  },
  'connect-redis': {
    pkg: 'connect-redis',
    module: true
  }
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

async function load (fastify, srvName, sdl = {}) {
  const { _, log } = fastify
  const pkgInfo = internal[srvName]
  if (_.isFunction(pkgInfo)) {
    return { inst: await pkgInfo(fastify, srvName, sdl) }
  } else if (_.isObject(pkgInfo)) {
    return { inst: await loadPkg(fastify, pkgInfo.pkg, pkgInfo.module) }
  }
  log.warn('请求的内部包%s不存在或无法加载。', srvName)
  return { inst: null }
}

function has (srvName) {
  return !!internal[srvName]
}

module.exports.load = load
module.exports.has = has
module.exports.loadPkg = loadPkg
