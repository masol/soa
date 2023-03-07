/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 26 Feb 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: storage

const Storage = require('@file-storage/core').default
const url = require('node:url')
const urlJoin = require('url-join').default

class StorageProxy {
  #base
  #bProxy
  #drvName
  #url // 如果指定了有效地址，则为URL对象，否则是一个string字符串，指明路径部分．
  constructor (opt, fastify) {
    const { _, log } = fastify
    this.#bProxy = !!opt.bProxy
    if (_.has(opt, 'bProxy')) delete opt.bProxy
    this.#base = opt.base
    if (_.has(opt, 'base')) delete opt.base
    this.#drvName = opt.drvName || ''
    if (_.has(opt, 'drvName')) delete opt.drvName

    // 本地文件或者启用Proxy.需要监听指定路径，提供服务．
    if (this.#bProxy || this.#drvName === 'LocalDriver') {
      try {
        this.#url = new url.URL(opt.base || '/').toString()
      } catch (e) { // INVALID_URL
        if (fastify.domain) {
          let domain = fastify.https ? 'https://' : 'http://'
          domain += fastify.domain
          try {
            this.#url = new url.URL(opt.base || '/', domain).toString()
            // console.log('this.#url=', this.#url)
          } catch (e) { }
        } else {
          log.warn('未设置服务域名，采用访问IP来替代域名,在运行期获取host信息．')
        }
      }
    }

    Storage.config(opt)
    console.log('Storage=', Storage)
  }

  // 使用crypto.randomUUID()来创建uuid.
  async readURL (uuid, opt = {}) {
    urlJoin(this.#url)
  }

  async writeURL (opt = {}) {
  }

  async init (fastify) {
    // 本地文件或者启用Proxy.需要监听指定路径，提供服务．
    // if (this.#bProxy || this.#drvName === 'LocalDriver') {
    // }
  }
}

module.exports = StorageProxy
