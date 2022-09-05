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
const defService = require('./services')

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
    return null
  }
  const loaderDL = sdl.loader
  if (_.isString(loaderDL)) {
    const loaderInfo = new url.URL(loaderDL)
    log.error('尚未实现从url方式加载loader,%o', loaderInfo)
    throw new error.NotImplementedError('尚未实现从loaderDL中获取loader.')
  } else if (_.isObject(loaderDL)) {
    throw new error.NotImplementedError('尚未实现从loaderDL JSON中获取loader.')
  }
  return await defService.load(fastify, srvName, sdl)
}

module.exports.load = load
