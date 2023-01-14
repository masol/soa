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

const internal = {
  docker: true,
  elastic: true,
  redis: true,
  vault: true,
  knex: true,
  keycloak: true,
  fsm: true,
  cache: true,
  oss: true,
  corsess: true,
  socketio: true,
  corws: true
}

async function load (fastify, srvName, sdl = {}) {
  const { log, _ } = fastify
  if (internal[srvName]) {
    try {
      const service = require(`./${srvName}`)
      if (service && _.isFunction(service.load)) {
        if (!fastify.runcmd || fastify.runcmd.verbose) {
          log.info('加载%s服务,启动参数:%o', srvName, sdl)
        }
        return await service.load(fastify, sdl)
      } else {
        log.error('获取默认服务%s时发生内部错误:未实现服务加载', srvName)
      }
    } catch (e) {
      log.error('获取默认服务%s时发生错误:%s', srvName, e)
    }
  }
  log.warn('请求的默认基础组件%s不存在或无法加载。', srvName)
  return { inst: null }
}

function has (srvName) {
  return internal[srvName]
}

module.exports.load = load
module.exports.has = has
