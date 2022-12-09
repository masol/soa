/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 6 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: config

const path = require('path')
const _ = require('lodash')

module.exports.ext = (config) => {
  function contain (propPath, chkValue) {
    if (!propPath || !_.isString(propPath)) {
      return false
    }
    if (!config.has(propPath)) {
      return false
    }
    const container = config.get(propPath)
    return (_.isArrayLike(container) && _.indexOf(container, chkValue) >= 0)
  }
  _.set(config, 'util.contain', contain)
  _.set(config, 'util.dget', (propPath, defValue = {}) => {
    if (!propPath || !_.isString(propPath)) {
      return defValue
    }
    return config.has(propPath) ? config.get(propPath) : defValue
  })
  _.set(config, 'util.isDisabled', _.bind(contain, null, 'env.conf.disabled-plugins'))
  _.set(config, 'util.isEnabled', _.bind(contain, null, 'env.conf.enabled-plugins'))
  const base = process.cwd()
  _.set(config, 'util.path', (...args) => {
    const newarg = [base, ...Array.from(args)]
    return path.join.apply(null, newarg)
  })
  const cfgBase = path.join(base, 'config', 'active')
  _.set(config, 'util.cfgpath', (...args) => {
    const newarg = [cfgBase, ...Array.from(args)]
    return path.join.apply(null, newarg)
  })
}
