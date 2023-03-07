/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 26 Feb 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: index

const StorageProxy = require('./storage')
const path = require('path')

async function importLocal (fastify, packageName) {
  const module = require(packageName).default
  return (module && module.__esModule && module.default) ? module.default : module
}

async function loadCfg (fastify, conf, sdl) {
  const { _, fse, error } = fastify
  if (_.isString(conf.driver)) {
    conf.drvName = conf.driver
    switch (conf.driver) {
      case 'LocalDriver':
        conf.driver = await importLocal(fastify, '@file-storage/local')
        if (!conf.root) {
          throw new error.PreconditionRequiredError('本地存储必须指定root参数.')
        }
        if (!path.isAbsolute(conf.root)) {
          conf.root = path.join(fastify.dirname, conf.root)
        }
        await fse.ensureDir(conf.root)
        // console.log('conf.root=', conf.root)
        break
      case 'S3Driver':
        conf.driver = await importLocal(fastify, '@file-storage/s3')
        break
      case 'GoogleCloudStorageDriver':
        conf.driver = await importLocal(fastify, '@file-storage/gcs')
        break
      case 'FtpDriver':
        conf.driver = await importLocal(fastify, '@file-storage/ftp')
        break
      case 'SftpDriver':
        conf.driver = await importLocal(fastify, '@file-storage/sftp')
        break
    }
  }

  if (_.isArray(conf.plugins)) {
    for (let i = 0; i < conf.plugins.length; i++) {
      const plg = conf.plugins[i]
      if (_.isString(plg)) {
        let plgConf = null
        if (_.isObject(sdl[plg])) {
          plgConf = _.cloneDeep(sdl[plg])
        }
        switch (plg) {
          case 'ImageManipulation':
            conf.plugins[i] = await importLocal(fastify, '@file-storage/image-manipulation')
            if (plgConf) {
              conf.plugins[i].conf(plgConf)
            }
            break
        }
      }
    }
  }
}

module.exports.load = async function (fastify, sdl = {}) {
  const { _ } = fastify
  const pubCfg = _.isObject(sdl.pub)
    ? _.cloneDeep(sdl.pub)
    : {
        driver: 'LocalDriver',
        name: 'local',
        root: 'pubres',
        base: '/pubres'
      }
  await loadCfg(fastify, pubCfg, sdl)

  const privCfg = _.isObject(sdl.priv)
    ? _.cloneDeep(sdl.pub)
    : {
        driver: 'LocalDriver',
        name: 'local',
        root: 'privres',
        base: '/privres'
      }
  await loadCfg(fastify, privCfg, sdl)
  const pub = new StorageProxy(pubCfg, fastify)
  const priv = new StorageProxy(privCfg, fastify)
  await pub.init(fastify)
  await priv.init(fastify)
  return {
    inst: {
      pub,
      priv
    }
  }
}
