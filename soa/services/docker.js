/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 5 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: docker

module.exports.load = async function (fastify, sdl = {}) {
  const { _ } = fastify
  const Dockerode = await fastify.shell.require('dockerode')
  const opt = sdl.conf || {}
  let dockerInst
  if (_.isEmpty(opt)) {
    dockerInst = new Dockerode()
  } else {
    dockerInst = new Dockerode(opt)
  }
  return { inst: dockerInst }
}
