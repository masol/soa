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

const fs = require('fs').promises
const path = require('path')

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
  const { _, config } = fastify
  const cfgutil = config.util
  const localcfg = _.clone(sdl)
  localcfg.kconf = localcfg.kconf || {}
  const kconf = localcfg.kconf
  kconf.superuser = kconf.superuser || 'keycloak'
  if (!kconf.password) {
    const pwdir = cfgutil.path('config', 'active', 'keycloak')
    await fs.mkdir(pwdir, { recursive: true }).catch(e => e) // 忽略EEXIST错误。
    const pwdfile = path.join(pwdir, 'passwd')
    kconf.password = await fs.readFile(pwdfile).catch(async e => {
      const passwd = _.cryptoRandom({ length: 16 })
      await fs.writeFile(pwdfile, passwd)
      return passwd
    })
  }

  localcfg.conf = localcfg.conf || {}
  const conf = localcfg.conf
  conf.disableCookiePlugin = true
  conf.disableSessionPlugin = true
  conf.appOrigin = conf.appOrigin || 'https://localhost:3000'
  conf.keycloakSubdomain = conf.keycloakSubdomain || 'https://localhost:3000/kc'
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
  const kch = await health(fastify, opts)
  if (!kch) {
    // deploy keycloak
    const env = await soa.get('env')
    fastify.log.warn('keycloak健康检查错误,开始%s热部署。', env.deploy)
    try {
      const deploy = require(`./${env.deploy}`)
      const bSuc = await deploy.deploy(fastify, opts)
      if (!bSuc) {
        return null
      }
    } catch (e) {
      fastify.log.warn('keycloak热部署期间发生错误:%s', e)
    }
  }
  // keycloak健康检查。
  // 确保session服务已加载。
  await soa.get('session')
  return { inst: null }
}

module.exports.load = load
