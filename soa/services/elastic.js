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

async function buildClient (fastify, Client, sdl = {}) {
  const cfgutil = fastify.config.util
  const { _, s } = fastify
  const baseOpt = {}
  baseOpt.node = 'https://localhost:9200'
  baseOpt.auth = {
    username: 'elastic'
  }
  baseOpt.tls = { }
  const conf = sdl.conf || {}
  if (!conf.caFingerprint) {
    const ca = await fs.readFile(cfgutil.path('config', 'active', 'elastic', 'http_ca.crt')).catch(e => {
      return null
    })
    if (ca) {
      baseOpt.tls.ca = ca
    }
  }
  const passwd = s.trim((await fs.readFile(cfgutil.path('config', 'active', 'elastic', 'passwd'), 'utf8').catch(e => {
    return ''
  })), [' ', '\n', '\r'])
  // console.log('passwd=', passwd)
  if (passwd) {
    baseOpt.auth.password = passwd
  }
  const opt = _.assign(baseOpt, conf)

  // fastify.log.debug('new elastic instance with opt=%o', opt)
  return new Client(opt)
}

async function load (fastify, sdl = {}) {
  const { Client } = await fastify.shell.require('@elastic/elasticsearch')

  const client = await buildClient(fastify, Client, sdl)
  // console.log('client=', client)
  const healthInfo = await client.cat.health().catch(async err => {
    fastify.log.error('elastic健康检查错误,错误:%s', err)
  })
  fastify.log.debug('elastic heathinfo=%o', healthInfo)
  return { inst: client }
}

module.exports.load = load
