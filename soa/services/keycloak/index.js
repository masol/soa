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
const realmApp = 'app'
const realmName = 'app'
const fastifyCid = 'fastify-server'

// async function health (fastify, sdl = {}) {
//   const { soa, _ } = fastify
//   const undici = await soa.get('undici')
//   // console.log('undici=', undici)
//   if (!undici) {
//     return false
//   }
//   // health check必须在编译期启用。
//   // https://www.keycloak.org/server/health keycloak health check.因此之判定是否可连接。
//   const result = await undici.request('http://localhost:8080/health').catch(err => {
//     console.log('keycloak err=', err)
//     return false
//   })
//   // https://github.com/nodejs/undici 比nodejs内置http模块更快的http通信。
//   if (_.isObject(result)) {
//     // @TODO: check content of result.
//     return true
//   }
//   console.log('result=', result)
//   return !!result
// }

// async function prepareCFG (fastify, sdl) {
//   const { _ } = fastify
//   const localcfg = _.clone(sdl)

//   localcfg.conf = localcfg.conf || {}
//   const conf = localcfg.conf
//   conf.clientId = '1a2673e0-1506-442c-a136-9aacbdcfe3eb'
//   conf.clientSecret = 'eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJiN2Q3YTVlOC02MGFiLTQ5MjktYTdkMi0zNGRhZWYwYmU3MGUifQ'
//   conf.disableCookiePlugin = true
//   conf.disableSessionPlugin = true
//   conf.logoutEndpoint = '/auth/logout'
//   conf.appOrigin = conf.appOrigin || 'https://localhost:3000'
//   conf.keycloakSubdomain = conf.keycloakSubdomain || 'https://localhost:8080'
//   return localcfg
// }

async function load (fastify, sdl = {}) {
  const { soa, log, _, config } = fastify
  const cfgutil = config.util
  const keycloak = await fastify.shell.import('fastify-keycloak-adapter')

  const kcbase = cfgutil.path('config', 'active', 'keycloak')
  const secreteFile = path.join(kcbase, 'server.cert')
  const idFile = path.join(kcbase, 'server.id')
  if (!keycloak) {
    return { inst: null }
  }
  // console.log('keycloak=', keycloak)

  const kcAdmin = await fastify.shell.import('@keycloak/keycloak-admin-client')
  const clientSecret = await fs.readFile(secreteFile, 'utf8').catch(e => {
    return ''
  })
  // log.debug('clientSecrete=%s', clientSecret)
  const KcAdmCls = kcAdmin.default ? kcAdmin.default : kcAdmin
  const srvCfg = _.isObject(sdl.conf) ? _.clone(sdl.conf) : {}
  const adpCfg = _.isObject(sdl.adapter) ? _.clone(sdl.adapter) : {}

  adpCfg.appOrigin = adpCfg.appOrigin || 'https://127.0.0.1:3000'
  adpCfg.keycloakSubdomain = adpCfg.keycloakSubdomain || '127.0.0.1:8080/realms/app'
  if (!adpCfg.clientId) {
    adpCfg.clientId = await fs.readFile(idFile, 'utf8').catch(e => { return '' })
  }
  if (!clientSecret) {
    adpCfg.clientSecret = await fs.readFile(secreteFile, 'utf8').catch(e => { return '' })
  }
  adpCfg.disableCookiePlugin = true
  adpCfg.disableSessionPlugin = true
  adpCfg.logoutEndpoint = adpCfg.logoutEndpoint || '/auth/logout'
  adpCfg.unauthorizedHandler = (request, reply) => {
    fastify.log('call to unauthorizedHandler')
    reply.status(401).send('Invalid request')
  }

  srvCfg.baseUrl = srvCfg.baseUrl || 'http://127.0.0.1:8080/'
  let initRealm = false
  if (!srvCfg.realmName) {
    if (clientSecret) {
      srvCfg.realmName = 'master' // realmApp
    } else {
      srvCfg.realmName = 'master'
      initRealm = true
    }
  }
  // log.debug('keycloak admin srvCfg=%o', srvCfg)
  const kcAdminClient = new KcAdmCls(srvCfg)
  // console.log('KcAdmin=', kcAdminClient)

  const connCfg = _.isObject(sdl.conn) ? _.clone(sdl.conn) : {}
  connCfg.username = connCfg.username || 'admin'
  connCfg.grantType = connCfg.grantType || 'password'
  connCfg.clientId = connCfg.clientId || 'admin-cli'
  if (!connCfg.password) {
    connCfg.password = await fs.readFile(path.join(kcbase, 'admin.passwd'), 'utf8').catch(e => {
      log.error('无法获取默认的keycloak管理员密码。错误:%o', e)
      return ''
    })
    if (!connCfg.password) {
      return { inst: null }
    }
  }
  let failed = false
  await kcAdminClient.auth(connCfg).catch(e => {
    log.error('配置信息，无法登录keycloak，错误:%s', e)
    failed = true
  })
  if (failed) {
    return { inst: null }
  }

  if (initRealm) { // 开始初始化app realm
    log.debug(`未发现合适空间，开始初始化${realmApp}空间。`)
    const realm = await kcAdminClient.realms.create({
      id: realmApp,
      realm: realmName
    }).catch(e => { log.debug('创建realm时发生错误:%s', e); return null })
    // console.log('realm=%o', realm)
    if (!realm || realm.realmName !== realmApp) {
      const realm = await kcAdminClient.realms.findOne({
        realm: realmName
      })
      // log.debug('realm=%o', realm)
      if (!realm) {
        log.error(`无法创建${realmApp}空间，需手动修复。`)
        return { inst: null }
      }
    }
    kcAdminClient.setConfig({
      realmName
    })

    let clientId = await fs.readFile(idFile, 'utf8').catch(e => {
      return ''
    })
    if (!clientId) {
      const createdClient = await kcAdminClient.clients.create({
        clientId: fastifyCid
      }).catch(e => { return null })
      if (!createdClient || !createdClient.id) {
        log.error(`无法创建${fastifyCid}客户端，需手动修复。`)
        return { inst: null }
      }
      clientId = createdClient.id
      adpCfg.clientId = adpCfg.clientId || clientId
      log.debug('created keycloak fastify-server client = %s', clientId)
      await fs.writeFile(idFile, clientId)
    }
    let credential = await fs.readFile(secreteFile, 'utf8').catch(e => { return '' })
    if (!credential) {
      const newCredential = await kcAdminClient.clients.generateNewClientSecret(
        {
          id: clientId
        })
      log.debug('generate keycloak server client credential=%o', newCredential)
      console.log('newCredential=', newCredential)
      credential = newCredential.value
      adpCfg.clientSecret = adpCfg.clientSecret || credential
      await fs.writeFile(secreteFile, credential)
    }
  } else {
    kcAdminClient.setConfig({
      realmName
    })
  }

  // KcAdmCls.client = kcAdminClient
  // await soa.reg('kcAdmin', { inst: KcAdmCls })

  // const opts = await prepareCFG(fastify, sdl)
  // console.log('keycloak opts=', opts)
  // 确保数据库及keycloak服务启动。
  await soa.get('knex')
  // const kch = await health(fastify, opts)
  // if (!kch) {
  //   // keycloak健康检查。
  //   log.error('keycloak健康检查错误,可能是knex中pg数据库配置错误,无法恢复此错误!')
  //   return { inst: null }
  // }
  // 确保session服务已加载。session会确保cookie依赖完成初始化。
  await soa.get('session')
  // log.debug('keycloak dep1!')
  await fastify.register(keycloak, adpCfg)
  // log.debug('keycloak ok!!')
  // if (!(_.isBoolean(sdl.proxy) && sdl.proxy === false)) {
  //   let proxyOpt = {}
  //   if (_.isObject(sdl.proxy)) {
  //     proxyOpt = sdl.proxy
  //   } else if (_.isString(sdl.proxy)) {
  //     proxyOpt.prefix = sdl.proxy
  //   }
  //   proxyOpt.upstream = proxyOpt.upstream || 'http://127.0.0.1:8080'
  //   proxyOpt.prefix = proxyOpt.prefix || 'kc'
  //   const proxyPlugin = await fastify.shell.require('@fastify/http-proxy')
  //   await fastify.register(proxyPlugin, proxyOpt)
  // }
  return { inst: kcAdminClient }
}

module.exports.load = load
