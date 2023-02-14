/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 5 Feb 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: lowdb

const path = require('path')
const cluster = require('cluster')

class LowDB {
  #dbmap // filePath => db
  #btext // 使用JSONFile.
  #bsync
  #lowdb
  #lowdbNode
  constructor (sdl) {
    this.#btext = !!sdl.text
    this.#bsync = !!sdl.sync
    this.#dbmap = {}
  }

  async init (fastify) {
    const lowdb = await import('lowdb')
    // Extend Low class with a new `chain` field
    class LowWithLodash extends lowdb.Low {
      constructor (adapter) {
        super(adapter)
        this.chain = fastify._.chain(this).get('data')
      }
    }
    this.#lowdb = {
      Low: LowWithLodash
    }
    this.#lowdbNode = await import('lowdb/node')
  }

  adapter (filePath) {
    let Cls
    // console.log('this.#lowdbNode=', this.#lowdbNode)
    if (this.#btext) {
      Cls = this.#bsync ? this.#lowdbNode.TextFileSync : this.#lowdbNode.TextFile
    } else {
      Cls = this.#bsync ? this.#lowdbNode.JSONFileSync : this.#lowdbNode.JSONFile
    }
    // console.log('Cls=', Cls)
    return new Cls(filePath)
  }

  normalize (filePath) {
    const fastify = global.fastify
    filePath = path.normalize(filePath)
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(fastify.dirname, filePath)
    }
    return filePath
  }

  async get (filePath) {
    const fastify = global.fastify
    filePath = this.normalize(filePath)
    let ret = this.#dbmap[filePath]
    if (!ret) {
      await fastify.fse.ensureFile(filePath)
      const adapter = this.adapter(filePath)
      this.#dbmap[filePath] = new this.#lowdb.Low(adapter)
      ret = this.#dbmap[filePath]
      await ret.read().catch(e => [])
      ret.data = ret.data || []
    }
    return ret
  }

  rm (filePath) {
    filePath = this.normalize(filePath)
    const ret = this.#dbmap[filePath]
    if (ret) {
      delete this.#dbmap[filePath]
    }
    return ret
  }
}

async function load (fastify, sdl = {}) {
  if (!cluster.isMaster) {
    throw new Error('lowdb不支持集群模式，设计用于单机环境下的dev模式．')
  }
  const inst = new LowDB(fastify, sdl)
  await inst.init(fastify)
  return { inst }
}

module.exports.load = load
