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
const path = require('path')

const HashiCorp = 'HashiCorp'

const bufExt = {
  '.crt': true
}

async function load (fastify, sdl = {}) {
  const { _ } = fastify
  const cfgutil = fastify.config.util
  const tokenPath = cfgutil.path('config', 'active', 'vault', 'root.token')

  const conf = sdl.conf || {}
  if (sdl.issue === HashiCorp) {
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
      fastify.log.error('vault健康检查错误。后续vault调用无效。错误:%s', err)
    })

    if (!health) {
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
      fastify.log.debug('vault cached keys=%s', keys)
      if (!_.isArray(keys)) {
        const msg = 'Vault Service已初始化,但是无法获取其key进行解封，自动处理不会出现此问题,人工配置问题?'
        fastify.log.error(msg)
        return { inst: null }
      }
      await vault.unseal({ secret_shares: secretShares, key: keys[0] })
    }
    fastify.log.debug('registed vault object=%o', vault)
    Vault.issue = HashiCorp
    return { inst: vault }
  } else {
    const vault = {
      issue: 'local',
      read: async (pathName, opt = {}) => {
        // 例如postgres/app.passwd, elastic/passwd, elastic/http_ca.crt
        const basePath = cfgutil.path('config', 'active')
        const subPath = path.join.apply(path, pathName.split('/'))
        const fullPath = path.join(basePath, subPath)
        const extName = path.extname(fullPath)
        const readOpt = {
          encoding: (opt.buffer || bufExt[extName]) ? null : 'utf8'
        }
        if (opt.throw) {
          return await fs.readFile(fullPath, readOpt)
        }
        return fs.readFile(fullPath, readOpt).catch(e => {
          return opt.erret || (readOpt.encoding ? '' : null)
        })
      }
    }

    return { inst: vault }
  }
}

module.exports.load = load
