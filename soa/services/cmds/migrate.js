/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 15 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: migrate

const fs = require('fs').promises
const path = require('path')

// 代表了一个Ver的操作．
class Ver {
  name
  #up // Array<(knex)=>Promise<void>
  #down // Array<(knex)=>Promise<void>
  constructor (ver) {
    this.name = ver
    this.#up = []
    this.#down = []
  }

  async init (baseDir) {
    const fastify = global.fastify
    const { _, $, log } = fastify
    const files = await $.glob(`${baseDir}/**/*.js`)
    for (let i = 0; i < files.length; i++) {
      try {
        const m = require(files[i])
        const op = await m(fastify)
        if (_.isObject(op)) {
          if (_.isFunction(op.up)) {
            this.#up.push(_.bindKey(op, 'up'))
          }
          if (_.isFunction(op.down)) {
            this.#down.push(_.bindKey(op, 'down'))
          }
        }
      } catch (e) {
        log.error("加载数据库定义'%s'时发生错误:%s", files[i], e)
      }
    }
  }

  // get version () {
  //   return this.version
  // }

  async up (knex) {
    for (const upOp of this.#up) {
      await upOp(knex)
    }
  }

  async down (knex) {
    for (const downOp of this.#down) {
      await downOp(knex)
    }
  }

  // config () {
  // return  { transaction: true }
  // }
}

/**
 * 扫描版本内容,并合并其中的up/down方法．
 * @param {string} pathname 开始扫描的根目录．
 */
async function scanVers (pathname) {
  const { s } = global.fastify
  const dirs = await fs.readdir(pathname).catch(e => {
    if (e.code === 'ENOENT') { // 忽略不存在的错误。
      return []
    }
    throw e
  })
  const verDirs = []
  for (const item of dirs) {
    const fullItem = path.join(pathname, item)
    const stats = await fs.stat(fullItem)
    if (stats.isDirectory()) {
      verDirs.push({
        item,
        full: fullItem
      })
    }
  }
  verDirs.sort((a, b) => {
    const la = a.item.toLowerCase()
    const lb = b.item.toLowerCase()
    return s.naturalCmp(la, lb)
  })
  // console.log('verDirs=', verDirs)
  return verDirs
}

class Migrate {
  #vers // Array<Ver>
  constructor () {
    this.#vers = []
  }

  async #addVer (versDir) {
    for (const vInfo of versDir) {
      const ver = new Ver(vInfo.item)
      await ver.init(vInfo.full)
      this.#vers.push(ver)
    }
  }

  async init (fastify) {
    const coreVers = await scanVers(path.join(__dirname, 'db'))
    if (coreVers.length > 0) {
      await this.#addVer(coreVers)
    }
    const userVers = await scanVers(path.join(fastify.dirname, 'src', 'helper', 'schemas', 'db'))
    if (userVers.length > 0) {
      await this.#addVer(userVers)
    }
  }

  // Must return a Promise containing a list of migrations.
  // Migrations can be whatever you want,
  // they will be passed as arguments to getMigrationName
  // and getMigration
  getMigrations () {
    // In this example we are just returning migration names
    // console.log('vers=', this.#vers)
    return Promise.resolve(this.#vers)
  }

  getMigrationName (ver) {
    // console.log('getMigrationName ver=', ver)
    return ver.name
  }

  getMigration (ver) {
    // console.log('ver=', ver)
    // return null
    return ver
  }
}

module.exports.run = async function (fastify, opts = {}) {
  const { soa, runcmd, log, _ } = fastify
  const knex = await soa.get('knex')
  // console.log('opts=', fastify.runcmd)
  if (fastify.runcmd._ && fastify.runcmd._.length > 0) {
    fastify.runcmd[fastify.runcmd._[0]] = true
  }
  const migrate = new Migrate(fastify, opts)
  await migrate.init(fastify)
  const conf = { migrationSource: migrate }
  let opStr
  if (runcmd.down) {
    opStr = '回滚'
    await knex.migrate.rollback(conf, !!runcmd.all)
  } else if (runcmd.up) {
    opStr = '升级'
    await knex.migrate.up(conf)
  } else if (runcmd.current) {
    const current = await knex.migrate.currentVersion(conf)
    if (!current) {
      log.info('当前集群数据库尚未定义任意版本的结构．')
    } else {
      log.info('当前集群数据库结构的版本为:%s', current)
    }
  } else if (runcmd.list) {
    const list = _.flatten(await knex.migrate.list(conf))
    // console.log('list=', list)
    log.info('全部有效的版本:%s', list ? String(_.map(list, 'name')) : '无')
  } else if (runcmd.unlock) {
    const unlock = await knex.migrate.unlock(conf)
    log.info('强制解锁完成:%s', unlock)
  } else {
    opStr = '升级至最新版本'
    await knex.migrate.latest(conf)
  }
  if (opStr) {
    log.info('%s完毕，当前数据库结构版本:%s', opStr, await knex.migrate.currentVersion(conf))
  }
}
