/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 23 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: boot

// static默认检查，但是如未配置且不是本地，不注册。
const defPlugins = ['gql', 'cors', 'accepts', 'compress', 'static', 'session', 'formbody', 'multipart', 'objection']
const defPkgs = []

async function setup (fastify, opts) {
  const { soa, _, $, config } = fastify
  const cfgutil = config.util
  const allServices = _.remove(_.keys(config), 'util')
  const regSrv = async (srvName) => {
    if (soa.has(srvName)) {
      return false // 已注册，忽略新请求
    }
    const opt = _.assign({}, opts[srvName], cfgutil.dget(srvName))
    // 检查是否禁用。
    if (!opt.disabled) {
      // fastify.log.debug('加载服务"%s" opts=%o', srvName, opt)
      await soa.load(srvName, opt)
    }
  }
  await Promise.all([
    $.map(allServices, regSrv),
    $.map(defPlugins, async (plugName) => {
      // fastify.log.debug('enter plugin init!!')
      // fastify.log.debug('reg def plugin=%s', plugName)
      await regSrv(plugName)
    }),
    $.map(defPkgs, async (pkgName) => {
      // fastify.log.debug('enter package init!!')
      if (!config.has(pkgName)) { // config中没有定义此package，因此没有禁止。
        await regSrv(pkgName)
      }
    })
  ])
  const env = await soa.get('env')
  fastify.log.debug('enter service preload=%o', env.services())
  await $.map(env.services(), async (srvName) => {
    fastify.log.debug('预加载服务%s', srvName)
    // 注意，无需await,预加载的服务不会注册路由.
    await regSrv(srvName)
  })
}

module.exports.setup = setup
