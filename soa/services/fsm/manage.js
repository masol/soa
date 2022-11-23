/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 6 Nov 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: base

const FSMBase = require('./fsmbase')
const path = require('path')

class FSManger {
  #factories
  #fastify

  static FSM = FSMBase
  constructor (fastify) {
    this.#fastify = fastify
    this.#factories = {}
  }

  get $fastify () {
    return this.#fastify
  }

  /**
   * 注册fsm类
   */
  reg (clsName, Cls) {
    console.log('register :', clsName, Cls)
    this.#factories[clsName] = Cls
  }

  /**
   * 获取指定id的状态机(fsm)。
   * @param {string} clsName
   * @param {any} id 一个状态机的id,如未传入，则返回初始状态的fsm。
   * @returns [FSM,null]
   */
  async load (clsName, id) {
    const module = this.#factories[clsName]
    console.log('module=', module)
    const ret = await module.load(this, id)
    return ret
  }

  async scan (baseDir) {
    const { $, log, s } = this.#fastify
    const files = await $.glob(`${baseDir}/**/*.js`)
    // console.log('scan fsms....')
    for (let i = 0; i < files.length; i++) {
      const relPath = path.relative(baseDir, files[i])
      let fsmId = relPath.substring(0, relPath.length - 3) // len('.js') === 3
      if (path.sep !== '/') {
        fsmId = s.replaceAll(fsmId, path.sep, '/')
      }
      // console.log('fsmId=', fsmId)
      try {
        const m = require(files[i])
        this.reg(m.id || fsmId, m)
      } catch (e) {
        log.error("加载fsm '%s'时发生错误:%s", files[i], e)
      }
    }
  }
}

module.exports = FSManger
