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

  let deploypg = false
  if (!conf.client) {
    conf.client = 'pg'
    deploypg = true
    conf.connection = {
      host: '127.0.0.1',
      port: 5432,
      user: 'postgres',
      database: 'app'
    }
    const pwdfile = cfgutil.path('config', 'active', 'postgres', 'app.passwd')
    conf.connection.password = await fs.readFile(pwdfile, 'utf8').catch(async e => {
      const newpwd = _.cryptoRandom({ length: 16 })
      await fs.writeFile(pwdfile, newpwd)
      log.debug('为pg产生默认密码:%s', newpwd)
      return newpwd
    })
  }

  // log.debug('knext conf=%o', conf)
  await fastify.shell.require(conf.client)
  const client = createKnex(conf)
  const kenxUtils = await soa.get('knex-utils')
  if (!kenxUtils) {
    log.warn('无法加载knex-utils,未能检查heartbeat.')
  } else {
    let heart = await kenxUtils.checkHeartbeat(client).catch(e => {
      return {
        isOk: false,
        error: e
      }
    })
    if (_.isObject(heart) && !heart.isOk) {
      if (deploypg) {
        const env = await soa.get('env')
        log.warn('postgres健康检查错误,开始%s热部署。', env.deploy)
        try {
          const deploy = require(`./${env.deploy}`)
          const bSuc = await deploy.deploy(fastify, conf)
          if (!bSuc) {
            return null
          }
        } catch (e) {
          fastify.log.warn('postgres热部署期间发生错误:%s', e)
        }
        heart = await kenxUtils.checkHeartbeat(client).catch(e => e)
      } else {
        log.warn('knex-utils: heartbeat失败:%s', heart.error ? heart.error.code : JSON.stringify(heart))
      }
    }
    log.debug('knext heart=%o', heart)
  }
  // log.debug('knex loaded ok!')
  return { inst: client }
}

module.exports.load = load
