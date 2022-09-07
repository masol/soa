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
const _ = require('lodash')

async function decorate (fastify, opts) {
  const cryptoRandom = await import('crypto-random-string')
  _.cryptoRandom = cryptoRandom.default
  // console.log('_.cryptoRandom=', _.cryptoRandom)
  // console.log('_.cryptoRandom()=', _.cryptoRandom({ length: 64 }))
  fastify.decorate('_', _)

  extConfig.ext(fastify, opts)

  const $ = _.extend({}, promiseUtils, goodies)
  // 为$扩展lift系列函数。
  // extProm.ext(fastify, $)
  fastify.decorate('$', $)

  const error = await import('http-errors-enhanced')
  fastify.decorate('error', error)

  // 为shelljs扩展require和import函数。
  extShelljs.ext(fastify, shelljs)
  fastify.decorate('shell', shelljs)

  fastify.decorate('soa', SOA.instance(fastify, opts))
}

module.exports.decorate = decorate
