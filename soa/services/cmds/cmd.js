/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 15 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: cmd

class Cmd {
  #basepath // 命令文件的基础路径．如果未指定，默认为src/cmds下的包.
  #internal // :{name:string,module:Array<Module>} 内部命令．
  constructor (opts = {}) {
    this.#basepath = opts.basepath
    this.#internal = {}
  }

  /**
  * 为指定的命令添加运行参数．
  */
  addCmd (cmdName, module) {
    this.#internal[cmdName] = this.#internal[cmdName] || []
    this.#internal[cmdName].push(module)
  }

  async init (fastify) {
    this.addCmd('migrate', require('./migrate'))
  }

  async #runMod (mod, args) {
    const fastify = global.fastify
    const { _ } = fastify
    if (_.isArray(mod.dep)) {
      for (const depMod of mod.dep) {
        await this.run(depMod, args)
      }
    } else if (_.isString(mod.dep)) {
      await this.run(mod.dep, args)
    }
    await mod.run(fastify, args)
  }

  /**
 * 执行一个命令．
 * @param {String} cmdName
 * @param {Object} args  类似fastify.runcmd结构的参数．
 */
  async run (cmdName, args) {
    const { reqbase, log } = global.fastify
    const intCmd = this.#internal[cmdName] || []
    const runInt = intCmd.length > 0
    if (runInt) {
      for (const mod of intCmd) {
        await this.#runMod(mod, args)
      }
    }
    try {
      if (this.#basepath) {
        await this.#runMod(require(this.#basepath), args)
      } else {
        await this.#runMod(reqbase(`src/cmds/${cmdName}`), args)
      }
    } catch (e) {
      const msg = `请求执行命令${cmdName},但是命令路径下无此命令．${runInt ? '但是系统支持此命令，已执行完毕．' : ''}`
      if (runInt) {
        log.debug(msg)
      } else {
        log.error(msg)
        throw e
      }
    }
  }
}

module.exports = Cmd
