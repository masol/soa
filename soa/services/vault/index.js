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

const fs = require('fs').promises

async function load (fastify, sdl = {}) {
  const { soa, _, $ } = fastify
  const cfgutil = fastify.config.util
  const tokenPath = cfgutil.path('config', 'active', 'vault', 'root.token')

  const conf = sdl.conf || {}
  if (!conf.token) { // 从文件中加载token.
    const token = await fs.readFile(tokenPath).catch(e => {
      return null
    })
    if (token) {
      conf.token = token
      fastify.log.debug('read vault cached token=%s', conf.token)
    }
  }
  const Vault = await fastify.shell.require('node-vault')
  const vault = await Vault(conf)
  const health = await vault.health().catch(async (err) => {
    const env = await soa.get('env')
    fastify.log.warn('vault健康检查错误,开始%s热部署。错误:%s', env.deploy, err)
    const deploy = require(`./${env.deploy}`)
    const bSuc = await deploy.deploy(fastify, sdl)
    if (!bSuc) {
      return null
    }
    return await $.retry(_.bindKey(vault, 'health'), { maxAttempts: 5, delayMs: 1000 })().catch(e => {
      fastify.log.error('vault health错误:%s', e)
      return null
    })
  })

  if (!health) {
    fastify.log.error('因此无法初始化vault对象。后续vault调用无效。')
    return { inst: null }
  }

  fastify.log.debug('vault health=%o', health)
  const keyPath = cfgutil.path('config', 'active', 'vault', 'root.key')
  if (!health.initialized) { // 尚未初始化.开始初始化.
    const initOpt = {
      secret_shares: conf.secret_shares || 1,
      secret_threshold: conf.secret_threshold || 1
    }
    const initInfo = await vault.init(initOpt)
    await fs.writeFile(keyPath, JSON.stringify(initInfo.keys))
    await fs.writeFile(tokenPath, initInfo.root_token)
    fastify.log.debug('vault init result=%o', initInfo)
  }

  if (health.sealed) { // 初始化,但是处于封印状态,开始解封.
    const secretShares = conf.secret_shares || 1
    const keystr = await fs.readFile(keyPath).catch(e => {
      return null
    })
    const keys = keystr ? JSON.parse(keystr) : null
    fastify.log.debug('keys=%s', keys)
    if (!_.isArray(keys)) {
      const msg = 'Vault Service已初始化,但是无法获取其key进行解封，自动处理不会出现此问题,人工配置问题?'
      fastify.log.error(msg)
      return { inst: null }
    }
    await vault.unseal({ secret_shares: secretShares, key: keys[0] })
  }
  fastify.log.debug('registed vault object=%o', vault)
  return { inst: vault }
}

module.exports.load = load
