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
  await soa.get('session')
  // console.log('passport=', passportModule.initialize())
  fastify.register(passport.initialize())
  fastify.register(passport.secureSession())
  const ioCfg = _.isObject(sdl.conf) ? _.clone(sdl.conf) : {}
  if (!ioCfg.adapter) {
  // @fixme: support adapter config.
  // const adpCfg = _.isObject(sdl.adapter) ? _.clone(sdl.adapter) : {}
  }
  log.debug('passport loaded!')
  return { inst: passportModule }
}
