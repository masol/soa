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

const env = require('./env')

const internal = {
  fastify: async (fastify, srvName, sdl) => {
    // const conf = sdl.conf || {}
    // if (conf.https || conf.http2) { // 注册'https-redirect'
    // await fastify.soa.get('https-redirect')
    // }
    return { inst: fastify }
  },
  env: env.load
}

async function load (fastify, srvName, sdl = {}) {
  const { _, log } = fastify
  const handler = internal[srvName]
  if (_.isFunction(handler)) {
    return await handler(fastify, srvName, sdl)
  }
  log.warn('请求的默认基础组件%s不存在或无法加载。', srvName)
  return { inst: null }
}

function has (srvName) {
  return internal[srvName]
}

module.exports.load = load
module.exports.has = has
