/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 7 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: index

// const fs = require('fs').promises
// const path = require('path')

async function health (fastify, sdl = {}) {
  const { soa, _ } = fastify
  const undici = await soa.get('undici')
  // console.log('undici=', undici)
  if (!undici) {
    return false
  }
  // health check必须在编译期启用。
  // https://www.keycloak.org/server/health keycloak health check.因此之判定是否可连接。
  const result = await undici.request('http://localhost:8080/health').catch(err => {
    console.log('keycloak err=', err)
    return false
  })
  // https://github.com/nodejs/undici 比nodejs内置http模块更快的http通信。
  if (_.isObject(result)) {
    // @TODO: check content of result.
    return true
  }
  console.log('result=', result)
  return !!result
}

async function prepareCFG (fastify, sdl) {
  const { _ } = fastify
  const localcfg = _.clone(sdl)

  localcfg.conf = localcfg.conf || {}
  const conf = localcfg.conf
  conf.disableCookiePlugin = true
  conf.disableSessionPlugin = true
  conf.appOrigin = conf.appOrigin || 'https://localhost:3000'
  conf.keycloakSubdomain = conf.keycloakSubdomain || 'https://localhost:3000/kc'
  return localcfg
}

async function load (fastify, sdl = {}) {
  const { soa } = fastify
  const keycloak = (await fastify.shell.import('fastify-keycloak-adapter'))
  if (!keycloak) {
    return { inst: null }
  }
  // const cfgutil = fastify.config.util
  console.log('keycloak=', keycloak)

  const opts = await prepareCFG(fastify, sdl)
  console.log('keycloak opts=', opts)
  // 确保数据库及keycloak服务启动。
  await soa.get('knex')
  const kch = await health(fastify, opts)
  if (!kch) {
    // deploy keycloak
    fastify.log.error('keycloak健康检查错误,knex中pg数据库配置错误,无法恢复此错误!')
    return { inst: null }
  }
  // keycloak健康检查。
  // 确保session服务已加载。
  await soa.get('session')
  return { inst: null }
}

module.exports.load = load
