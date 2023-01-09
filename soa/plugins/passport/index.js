/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 11 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: passport

module.exports.load = async function (fastify, srvName, sdl = {}) {
  const { soa } = fastify
  const { loadPkg } = require('../../pkgs')
  const env = await soa.get('env')
  const session = console.log('evn.sess=', env.sess)
  await soa.get(env.sess)
  const passportModule = (await loadPkg(fastify, '@fastify/passport', true))
  // const passport = new passportModule.Authenticator()
  const passport = passportModule.default
  passport.module = passportModule
  // 策略放在auth模块中实现。
  // const strategiesCFG = _.isObject(sdl.conf) ? _.clone(sdl.conf) : {}
  // if (!strategiesCFG.local) { // 如果未指定，添加默认的local strategy.
  //   strategiesCFG.local = {}
  // }
  // const strategies = _.keys(strategiesCFG)
  // for (let i = 0; i < strategies.length; i++) {
  //   const stratName = strategies[i]
  //   const stratCfg = strategiesCFG[stratName]
  //   if (!stratName.disabled) {
  //     try {
  //       const load = require(`./${stratName}`)
  //       await load(fastify, passport, stratCfg)
  //     } catch (e) {
  //       log.error(`加载认证策略${stratName}时发生错误:%s`, e)
  //     }
  //   }
  // }
  passport.registerUserSerializer(async (user, request) => {
    // console.log('registerUserSerializer: user=', user)
    // log.debug('enter serializer:%o', user)
    if (env.sess === 'corsess') {
      await session.ensure(request)
    }
    return JSON.stringify(user)
  })

  // ... and then a deserializer that will fetch that user from the database when a request with an id in the session arrives
  passport.registerUserDeserializer(async (id, request) => {
    // log.debug('enter deserializer=%s', id)
    return JSON.parse(id)
  })

  // console.log('passport=', passportModule.initialize())
  await fastify.register(passport.initialize())
  await fastify.register(passport.secureSession())

  // log.debug('passport loaded!')
  return { inst: passport }
}
