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

async function decorate (fastify, opts) {
  const cryptoRandom = await import('crypto-random-string')
  _.cryptoRandom = cryptoRandom.default
  _.glob = require('glob')
  // console.log('_.cryptoRandom=', _.cryptoRandom)
  // console.log('_.cryptoRandom()=', _.cryptoRandom({ length: 64 }))
  fastify.decorate('_', _)

  const s = require('underscore.string')
  s.v = require('validator')
  fastify.decorate('s', s)

  extConfig.ext(fastify, opts)

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
  // 为$扩展lift系列函数。
  // extProm.ext(fastify, $)
  fastify.decorate('$', $)

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
function ajvPlugin (ajv, opts) {
  console.error('NOT IMPLEMENT:(add validator.js format to ajv)call into ajvPlugin')
}

module.exports.decorate = decorate
module.exports.ajvPlugin = ajvPlugin
