/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 14 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: multer

const { loadPkg } = require('../pkgs')

module.exports.load = async function (fastify, srvName, sdl = {}) {
  const { _, config } = fastify
  const cfgutil = config.util
  const multer = await loadPkg(fastify, 'fastify-multer', false)
  fastify.register(multer.contentParser)
  const cfg = _.isObject(sdl.conf) ? _.clone(sdl.conf) : {}
  cfg.dest = cfg.dest || cfgutil.path('config', 'active', 'uploads')
  const upload = multer(cfg)
  upload.module = multer
  return { inst: upload }
}
