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

const Storage = require('./storage')

async function importLocal (packageName) {
  const module = await import(packageName)
  return (module && module.__esModule && module.default) ? module.default : module
}

module.exports.load = async function (fastify, sdl = {}) {
  const { _ } = fastify
  const conf = _.isObject(sdl.conf)
    ? _.cloneDeep(sdl.conf)
    : {
        driver: 'LocalDriver',
        name: 'local',
        root: '/srv/webapi/res'
      }

  if (_.isString(conf.driver)) {
    switch (conf.driver) {
      case 'LocalDriver':
        conf.driver = await importLocal('@file-storage/local')
        break
      case 'S3Driver':
        conf.driver = await importLocal('@file-storage/s3')
        break
      case 'GoogleCloudStorageDriver':
        conf.driver = await importLocal('@file-storage/gcs')
        break
      case 'FtpDriver':
        conf.driver = await importLocal('@file-storage/ftp')
        break
      case 'SftpDriver':
        conf.driver = await importLocal('@file-storage/sftp')
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
            conf.plugins[i] = await importLocal('@file-storage/image-manipulation')
            if (plgConf) {
              conf.plugins[i].conf(plgConf)
            }
            break
        }
      }
    }
  }

  const inst = new Storage(conf)
  return { inst }
}
