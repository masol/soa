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

async function buildClient (fastify, Client, sdl = {}) {
  const { _, s, soa } = fastify
  const baseOpt = {}
  baseOpt.node = 'https://localhost:9200'
  baseOpt.auth = {
    username: 'elastic'
  }
  baseOpt.tls = { }
  const conf = sdl.conf || {}
  const vault = await soa.get('vault')
  if (!conf.caFingerprint) {
    const ca = await vault.read('elastic/http_ca.crt')
    if (ca) {
      baseOpt.tls.ca = ca
    }
  }
  const passwd = s.trim((await vault.read('elastic/passwd')), [' ', '\n', '\r'])
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
