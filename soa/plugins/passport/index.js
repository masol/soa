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
  const { soa, log, _ } = fastify
  const { loadPkg } = require('../../pkgs')
  const passportModule = (await loadPkg(fastify, '@fastify/passport', true))
  const passport = passportModule.default
  passport.module = passportModule
  await soa.get('session')
  // console.log('passport=', passportModule.initialize())
  fastify.register(passport.initialize())
  fastify.register(passport.secureSession())
  const strategiesCFG = _.isObject(sdl.conf) ? _.clone(sdl.conf) : {}
  if (!strategiesCFG.local) { // 如果未指定，添加默认的local strategy.
    strategiesCFG.local = {}
  }
  const strategies = _.keys(strategiesCFG)
  for (let i = 0; i < strategies.length; i++) {
    const stratName = strategies[i]
    const stratCfg = strategiesCFG[stratName]
    if (!stratName.disabled) {
      try {
        const load = require(`./${stratName}`)
        await load(fastify, passport, stratCfg)
      } catch (e) {
        log.error(`加载认证策略${stratName}时发生错误:%s`, e)
      }
    }
  }
  passport.registerUserSerializer(async (user, request) => { return JSON.stringify(user) })

  // ... and then a deserializer that will fetch that user from the database when a request with an id in the session arrives
  passport.registerUserDeserializer(async (id, request) => {
    return JSON.parse(id)
  })
  log.debug('passport loaded!')
  return { inst: passport }
}
