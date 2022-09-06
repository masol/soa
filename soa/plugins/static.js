/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 5 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: static

const { loadPkg } = require('../pkgs')

/**
 * 额外的加载static的代码。
 * 参考https://github.com/fastify/fastify-static#multiple-prefixed-roots，启用subPath映射。
 * @param {*} fastify
 * @param {*} sdl
 */
module.exports.load = async function (fastify, sdl = {}) {
  const cfgutil = fastify.config.util
  const conf = sdl.conf || {}
  let subPath = conf.pathes || []
  if (!fastify._.isArray(subPath)) {
    subPath = []
  }
  if (cfgutil.isLocal()) { // 无条件启用plugin.并修正root目录。
    conf.root = cfgutil.path('root')
    // subPath.push({ root: path.join(cfgutil.path(), '..', '..', 'root'), prefix: '/admin/' })
  }
  if (conf.root || subPath.length > 0) {
    const fastifyStatic = await loadPkg(fastify, '@fastify/static', false)
    if (conf.root) {
      fastify.register(fastifyStatic, conf)
      fastify.log.info('启用静态(static)插件,启动参数:%o', conf)
    }
    fastify._.each(subPath, (v) => {
      v.decorateReply = false
      fastify.register(fastifyStatic, v)
      fastify.log.info('再次注册静态(static)路径,启动参数:%o', v)
    })
    return { inst: fastifyStatic }
  }
  return { inst: null }
}
