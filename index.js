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

const promiseUtils = require('blend-promise-utils')
const goodies = require('@supercharge/goodies')
const shelljs = require('shelljs')
const SOA = require('./soa')
const extShelljs = require('./lib/pkg')
// 是否采用https://github.com/sindresorhus/pify来扩展promise使用?
// const extProm = require('./lib/promise')
const extConfig = require('./lib/config')
const extUtil = require('./lib/util')
const _ = require('lodash')
const bootstrap = require('./lib/boot')

/**
 * 为了方便pipeline的工具使用，将fastify decorate的工具类抽取出来。
 * @param {Object} config 全局config对象。为其扩展便捷函数。
 * @returns
 */
async function getUtil(config) {
  const cryptoRandom = await import('crypto-random-string')
  _.cryptoRandom = cryptoRandom.default
  _.glob = require('glob')
  const s = require('underscore.string')
  s.v = require('validator')
  if (_.isObject(config)) {
    extConfig.ext(config)
  }

  const $ = _.extend({}, promiseUtils, goodies)
  $.glob = async function (pattern, options) {
    return new Promise((resolve, reject) => {
      _.glob(pattern, options, (err, files) => {
        if (err) {
          reject(err)
        } else {
          resolve(files)
        }
      })
    })
  }

  return {
    _,
    s,
    $,
    shelljs
  }
}

async function decorate(fastify, opts = {}) {
  const util = await getUtil(fastify.config)
  fastify.decorate('_', util._)

  fastify.decorate('s', util.s)

  if (util._.isObject(opts.fastify) && util._.isString(opts.fastify.domain)) {
    const domainArray = opts.fastify.domain.split(',').map(e => util.s.trim(e))
    // console.log("domainArray=", domainArray)
    const s = util.s
    fastify.addHook('onRequest', (request, reply, done) => {
      const host = s.trim(s.strLeft(request.headers.host, ':'))
      // console.log("request host=", host)
      if (domainArray.indexOf(host) < 0) {
        throw new error.BadRequestError('请使用合法域名访问.')
      }
      done()
    })
  }

  // 为$扩展lift系列函数。
  // extProm.ext(fastify, $)
  fastify.decorate('$', util.$)

  const error = await import('http-errors-enhanced')
  fastify.decorate('error', error)

  // 为shelljs扩展require和import函数。
  extShelljs.ext(fastify, shelljs)
  fastify.decorate('shell', shelljs)

  const soa = SOA.instance(fastify, opts)
  fastify.decorate('soa', soa)

  await extUtil.ext(fastify)
  // await soa.get('formbody')
  await bootstrap.setup(fastify, opts)
}

// 首次调用验证才会执行到这里，为ajv添加validator.js中的format.
function ajvPlugin(ajv, opts) {
  console.error('NOT IMPLEMENT:(add validator.js format to ajv)call into ajvPlugin')
}

module.exports.decorate = decorate
module.exports.ajvPlugin = ajvPlugin
module.exports.getUtil = getUtil
