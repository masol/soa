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

const fs = require('fs').promises

async function load (fastify, sdl = {}) {
  const { _, log, soa, config } = fastify
  const cfgutil = config.util
  const createKnex = await fastify.shell.require('knex')

  const conf = _.isObject(sdl.conf) ? _.clone(sdl.conf) : {}

  if (!conf.client) {
    conf.client = 'sqlite3'
    conf.connection = conf.connection || {}
    if (!conf.connection.filename) {
      const basePath = cfgutil.path('config', 'active', 'sqlite3', 'volumes')
      await fs.mkdir(basePath, { recursive: true }).catch(e => e) // 忽略EEXIST错误。
      conf.connection.filename = cfgutil.path(basePath, 'data.db')
    }
    conf.useNullAsDefault = true
    // sqlite3安装在本地
    // await fastify.shell.require('sqlite3')
    // console.log('sqlite3=', sqlite3)
  } // 非默认的sqlite,假定已经部署完毕！
  const client = createKnex(conf)
  const kenxUtils = await soa.get('knex-utils')
  if (!kenxUtils) {
    log.warn('无法加载knex-utils,未能检查heartbeat.')
  } else {
    await kenxUtils.checkHeartbeat(client).catch(e => {
      log.warn('knex-utils: heartbeat失败:%s', e)
    })
  }
  // log.debug('knex loaded ok!')
  return { inst: client }
}

module.exports.load = load
