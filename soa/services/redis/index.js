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
  const { soa, _, log } = fastify
  const baseOpt = {}
  const conf = sdl.conf || {}
  const opt = _.assign(baseOpt, conf)
  // const connectTimeout = opt.connectTimeout || 0 // 默认连接超时10分钟。

  // fastify.log.debug('new elastic instance with opt=%o', opt)
  const client = createClient(opt)
  let deploying = false
  const errorHandler = async (err) => {
    if (!deploying) { // 未执行部署，尝试部署。
      deploying = true
      const env = await soa.get('env')
      fastify.log.warn('redis无法连接到服务器,开始%s热部署。错误:%s', env.deploy, err)
      try {
        const deploy = require(`./${env.deploy}`)
        const bSuc = await deploy.deploy(fastify, sdl)
        if (!bSuc) { // 关闭client对error的监听，以禁用断线重连，使得connect函数可以退出继续。
          client.off('error', errorHandler)
        }
      } catch (e) {
        fastify.log.warn('redis热部署期间发生错误:%s', e)
      }
      deploying = false
    }
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
    client = await new Redis(sdl.conf)
    client.on('error', async function (err) {
      const env = await soa.get('env')
      fastify.log.warn('redis无法连接到服务器,开始%s热部署。错误:%s', env.deploy, err)
      try {
        const deploy = require(`./${env.deploy}`)
        const bSuc = await deploy.deploy(fastify, sdl)
        if (!bSuc) { // 关闭client对error的监听，以禁用断线重连，使得connect函数可以退出继续。
          fastify.log.warn('redis，无法成功热部署期。')
        }
      } catch (e) {
        fastify.log.warn('redis热部署期间发生错误:%s', e)
      }
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
