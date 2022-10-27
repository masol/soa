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

async function buildClient (fastify, createClient, sdl = {}) {
  const { _, log } = fastify
  const baseOpt = {}
  const conf = sdl.conf || {}
  const opt = _.assign(baseOpt, conf)
  // const connectTimeout = opt.connectTimeout || 0 // 默认连接超时10分钟。

  // fastify.log.debug('new elastic instance with opt=%o', opt)
  const client = createClient(opt)
  const errorHandler = async (err) => {
    fastify.log.error('redis无法连接到服务器,错误:%s', err)
  }
  client.on('error', errorHandler)

  let bSuc = true
  // fastify.log.debug('before redis connect!!!')
  const connFailed = async (err) => {
    log.error('无法连接到redis服务器:%s', err)
    bSuc = false
    return false
  }
  // if (_.isInteger(connectTimeout) && connectTimeout > 0) {
  //   log.debug('enter timeout')
  //   await $.timeout(_.bindKey(client, 'connect'), connectTimeout)().catch(connFailed)
  //   log.debug('leave timeout')
  // } else {
  await client.connect().catch(connFailed)
  // }
  // fastify.log.debug('return to redis client!!!')
  return bSuc ? client : null
}

async function load (fastify, sdl = {}) {
  const { _, log, soa } = fastify
  const pkg = sdl.package || 'ioredis'
  const vault = await soa.get('vault')
  const passwd = await vault.read('redis/password')
  const redisConf = _.isObject(sdl.conf) ? _.cloneDeep(sdl.conf) : {}
  if (passwd) { // 如果有密码，加入并覆盖配置中的密码项。
    redisConf.password = passwd
  }
  let client
  if (pkg === 'redis') {
    const redis = await fastify.shell.import('redis')
    if (!redis || !_.isFunction(redis.createClient)) {
      return { inst: null }
    }
    // console.log('createClient=', redis.createClient)
    // const cfgutil = fastify.config.util
    client = await buildClient(fastify, redis.createClient, sdl)
  } else {
    const Redis = await fastify.shell.require('ioredis')
    if (!Redis) {
      return { inst: null }
    }
    client = await new Redis(redisConf)
    client.on('error', async function (err) {
      fastify.log.warn('redis无法连接到服务器,错误:%s', err)
    })
    await client.ping().catch(err => {
      console.log('ioredis健康检查错误:', err)
    })
  }
  const pong = await client.ping().catch(err => {
    log.debug('redis健康检查错误:', err)
  })
  if (pong) {
    log.debug('redis health info:%s', pong)
    return { inst: client }
  }
  return { inst: null }
}

module.exports.load = load
