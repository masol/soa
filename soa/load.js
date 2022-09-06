/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 5 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: load

const url = require('url')

const parts = [require('./services'), require('./other'), require('./pkgs'), require('./plugins')]

async function loadef (fastify, srvName, sdl = {}) {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.has(srvName)) {
      return await part.load(fastify, srvName, sdl)
    }
  }
  fastify.log.warn('请求未定义loader的自定义服务%s。', srvName)
}

/**
 * 将sdl加载为服务入口。
 * @param {fastify} fastify
 * @param {Object} sdl
 * @return {Object}
 */
async function load (fastify, srvName, sdl = {}) {
  const { log, _, error } = fastify
  if (sdl.disable) {
    log.info('服务"%s"已被禁用，忽略之。', srvName)
    return { inst: null }
  }
  const loaderDL = sdl.loader
  if (_.isString(loaderDL)) {
    const loaderInfo = new url.URL(loaderDL)
    log.error('尚未实现从url方式加载loader,%o', loaderInfo)
    throw new error.NotImplementedError('尚未实现从loaderDL中获取loader.')
  } else if (_.isObject(loaderDL)) {
    throw new error.NotImplementedError('尚未实现从loaderDL JSON中获取loader.')
  }
  return await loadef(fastify, srvName, sdl)
}

module.exports = load
