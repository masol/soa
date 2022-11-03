/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 6 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: session
const { loadPkg } = require('../pkgs')

module.exports.load = async function (fastify, srvName, sdl = {}) {
  const { soa, log, _ } = fastify
  // const cfgutil = fastify.config.util
  // 确保cookie服务已加载。
  await soa.get('cookie')
  const session = await loadPkg(fastify, '@fastify/session', false)
  const conf = _.isObject(sdl.conf) ? _.cloneDeep(sdl.conf) : {}
  // console.log('sdl=', sdl)
  if (!conf.secret) {
    log.warn('session::未配置固定的secret,这导致每次重启服务无法获取上次session.')
    conf.secret = _.cryptoRandom({ length: 64 })
  }

  if (_.isString(conf.store)) {
    log.warn('session退化至内存store,尚未支持store的字符串定义:%s', conf.store)
  } else {
    const env = await soa.get('env')
    if (env.share === 'redis' && !conf.store) {
      const connectRedis = await loadPkg(fastify, 'connect-redis', true)
      const RedisStore = connectRedis.default(session)
      // console.log('RedisStore=', RedisStore)
      const redisClient = await soa.get('redis')
      // console.log('session store采用redis...%o', redisClient)
      if (redisClient) {
        conf.store = new RedisStore({ client: redisClient })
      } else {
        log.error('为session启用redis store时出错:无法获取redis服务对象。退化到内存存储。')
      }
    }
  }

  conf.cookieName = conf.cookieName || 'sid'
  conf.cookie = conf.cookie || { secure: false }
  conf.expires = conf.expires || 1800000
  if (!fastify.runcmd || fastify.runcmd.verbose) {
    log.info('启用@fastify/session插件,启动参数:%o', sdl.conf || {})
  }
  await fastify.register(session, conf)

  // if (conf.root || subPath.length > 0) {
  //   const fastifyStatic = await loadPkg(fastify, '@fastify/static', false)
  //   if (conf.root) {
  //     fastify.register(fastifyStatic, conf)
  //     fastify.log.info('启用静态(static)插件,启动参数:%o', conf)
  //   }
  //   fastify._.each(subPath, (v) => {
  //     v.decorateReply = false
  //     fastify.register(fastifyStatic, v)
  //     fastify.log.info('再次注册静态(static)路径,启动参数:%o', v)
  //   })
  //   return { inst: fastifyStatic }
  // }
  return { inst: session }
}
