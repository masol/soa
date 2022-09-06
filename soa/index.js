/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 5 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: index

const cache = require('memory-cache')
const load = require('./load')

const soa = {}
function instance (fastify) {
  if (!soa.get) {
    const { _, $, config } = fastify
    soa.get = async function (srvName) {
      let srvEntry = cache.get(srvName)
      if ($.isPromise(srvEntry)) {
        srvEntry = await srvEntry
        cache.put(srvName, srvEntry)
      }
      // fastify.log.debug('get srvName=%s,entry=%o', srvName, srvEntry)
      if (!srvEntry) {
        srvEntry = await load(fastify, srvName, config.util.dget(srvName))
        cache.put(srvName, srvEntry)
      }
      if (_.isObject(srvEntry)) {
        if ('inst' in srvEntry) {
          if ($.isPromise(srvEntry.inst)) {
            srvEntry.inst = await srvEntry.inst
          }
          return srvEntry.inst
        }
        if (srvEntry.loader) {
          if ($.isPromise(srvEntry.loader)) {
            srvEntry.loader = await srvEntry.loader
          }
          if (_.isFunction(srvEntry.loader)) {
            srvEntry.inst = await srvEntry.loader(fastify, config.util.dget(srvName)).catch(e => {
              return null
            })
            return srvEntry.inst
          }
        }
        return null
      }
    }

    soa.load = async (srvName, sdl = {}) => {
      const srvEntry = load(fastify, srvName, sdl)
      // fastify.log.debug('加载结果"%s"=%o', srvName, srvEntry)
      if (srvEntry) {
        cache.put(srvName, srvEntry)
        if ($.isPromise(srvEntry)) {
          await srvEntry
          cache.put(srvName, srvEntry)
        }
      }
    }

    soa.has = (srvName) => {
      return !!cache.get(srvName)
    }
  }
  return soa
}

module.exports.instance = instance
