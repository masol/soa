/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 5 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: index

const fs = require('fs').promises

const getPasswdPath = (cfgutil) => {
  return cfgutil.path('config', 'active', 'elastic', 'passwd')
}

const getCAPath = (cfgutil) => {
  return cfgutil.path('config', 'active', 'elastic', 'http_ca.crt')
}

async function buildClient (fastify, Client, sdl = {}) {
  const cfgutil = fastify.config.util
  const _ = fastify._
  const baseOpt = {}
  baseOpt.node = 'https://localhost:9200'
  baseOpt.auth = {
    username: 'elastic'
  }
  baseOpt.tls = {
  }
  const conf = sdl.conf || {}
  if (!conf.caFingerprint) {
    const caPath = getCAPath(cfgutil)
    const ca = await fs.readFile(caPath).catch(e => {
      return null
    })
    if (ca) {
      baseOpt.tls.ca = ca
    }
  }
  const passwdPath = getPasswdPath(cfgutil)
  const passwd = await fs.readFile(passwdPath).catch(e => {
    return null
  })
  if (passwd) {
    baseOpt.auth.password = passwd
  }
  const opt = _.assign(baseOpt, conf)

  // fastify.log.debug('new elastic instance with opt=%o', opt)
  return new Client(opt)
}

async function load (fastify, sdl = {}) {
  const { soa, _, $ } = fastify
  const { Client } = await fastify.shell.require('@elastic/elasticsearch')
  const cfgutil = fastify.config.util

  let client = await buildClient(fastify, Client, sdl)
  const healthInfo = await client.cat.health().catch(async err => {
    const env = await soa.get('env')
    fastify.log.warn('elastic健康检查错误,开始%s热部署。错误:%s', env.deploy, err)
    try {
      const deploy = require(`./${env.deploy}`)
      let needRebuild = false
      await fs.access(getPasswdPath(cfgutil), fs.F_OK).catch(async e => {
        needRebuild = true
      })
      if (!needRebuild) {
        await fs.access(getCAPath(cfgutil), fs.F_OK).catch(async e => {
          needRebuild = true
        })
      }

      const bSuc = await deploy.deploy(fastify, sdl)
      if (!bSuc) {
        return null
      }
      // // 检查是否有passwd.没有则调用reset-passwd
      if (needRebuild) {
        client = await buildClient(fastify, Client, sdl)
      }

      return await $.retry(_.bindKey(client.cat, 'health'), { maxAttempts: 5, delayMs: 1000 })().catch(e => {
        fastify.log.error('elastic health错误:%s', e)
        return null
      })
    } catch (e) {
      fastify.log.warn('elastic热部署期间发生错误:%s', e)
    }
  })
  fastify.log.debug('elastic heathinfo=%o', healthInfo)
  return { inst: client }
}

module.exports.load = load
