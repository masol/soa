/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 6 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: pkg

// use util.promisify, see https://nodejs.org/api/util.html#util_util_promisify_original
// const util = require('node:util')

module.exports.ext = (fastify, shelljs) => {
  const npmCache = {}
  const pexec = (cmdline, opts = {}) => {
    return new Promise((resolve) => {
      opts.async = true
      shelljs.exec(cmdline, opts, (code, stdout, stderr) => {
        resolve({
          code,
          stdout,
          stderr
        })
      })
    })
  }
  const installPkg = async (pkgName) => {
    // 此机制不跨进程，需要跨进程，例如基于redis或nfs,需要redis自举解耦。
    if (npmCache[pkgName]) {
      return await npmCache[pkgName]
    }
    try {
      const pm = fastify.config.util.dget('env.pkg', 'yarn')
      let cmdline = ''
      switch (pm) {
        case 'yarn':
          cmdline = `pwd;yarn add ${pkgName}`
          break
        case 'npm':
          cmdline = `npm install --save ${pkgName}`
          break
        case 'pnpm':
          cmdline = `pnpm add -P ${pkgName}`
          break
      }
      if (cmdline) {
        // @FIXME: 卡住当前nodejs，当时不能解决多进程互锁问题。还是切为lift promise。
        console.warn('请不要在产品环境下热部署！开始安装包%s，执行命令%s', pkgName, cmdline)
        // 改为异步版，以便不卡住主线程。
        npmCache[pkgName] = pexec(cmdline)
        // npmCache[pkgName] = shelljs.exec(cmdline, {
        //   async: false
        // })
        // fastify.log.info(npmCache[pkgName])
      }
    } catch (e) {
      fastify.log.error('install package "%s" error:%s', pkgName, e)
    }
    const pkg = await npmCache[pkgName]
    delete npmCache[pkgName]
    return pkg
  }
  shelljs.pexec = pexec
  shelljs.require = async (pkgName) => {
    let pkg
    try {
      pkg = fastify.require(pkgName)
    } catch (e) {
      // console.log('require package error:', e)
      await installPkg(pkgName)
      pkg = fastify.require(pkgName)
    }
    return pkg
  }
  shelljs.import = async (pkgName) => {
    return await fastify.import(pkgName).catch(async e => {
      // fastify.log.debug('import %s error:%s', pkgName, e)
      await installPkg(pkgName)
      return await fastify.import(pkgName).catch(e => null)
    })
  }
}
