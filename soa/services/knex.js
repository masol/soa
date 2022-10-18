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

async function load (fastify, sdl = {}) {
  const { _, log, soa } = fastify
  const createKnex = await fastify.shell.require('knex')

  const conf = _.isObject(sdl.conf) ? _.clone(sdl.conf) : {}
  const vault = await soa.get('vault')

  conf.client = conf.client || 'pg'
  if (typeof conf.client !== 'string') {
    throw new Error('knex配置文件错误，client必须是一个字符串。')
  }
  conf.connection = conf.connection || { host: '127.0.0.1' }
  conf.connection.port = conf.connection.port || 5432
  conf.connection.user = conf.connection.user || 'app'
  conf.connection.database = conf.connection.database || 'app'
  // 不产生新密码，如果密码不存在，直接抛出异常。
  conf.connection.password = conf.connection.password || await vault.read('postgres/app.passwd', { throw: true })

  // log.debug('knext conf=%o', conf)
  await fastify.shell.require(conf.client)
  const client = createKnex(conf)
  const kenxUtils = await soa.get('knex-utils')
  if (!kenxUtils) {
    log.warn('无法加载knex-utils,未能检查heartbeat.')
  } else {
    client.kenxUtils = kenxUtils
    const heart = await kenxUtils.checkHeartbeat(client).catch(e => {
      return {
        isOk: false,
        error: e
      }
    })
    if (_.isObject(heart) && !heart.isOk) {
      log.warn('knex-utils: heartbeat失败:%s', heart.error ? heart.error.code : JSON.stringify(heart))
    } else {
      log.debug('knext heart=%o', heart)
    }
  }
  // log.debug('knex loaded ok!')
  return { inst: client }
}

module.exports.load = load
