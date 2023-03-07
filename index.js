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
const om = require('objectmodel')
const moment = require('moment')
const net = require('net')
// const crc = require('crc')

const fs = require('fs').promises
const path = require('path')

/**
 * 为了方便pipeline的工具使用，将fastify decorate的工具类抽取出来。
 * @param {Object} config 全局config对象。为其扩展便捷函数。
 * @returns
 */
async function getUtil (config) {
  const cryptoRandom = await import('crypto-random-string')
  _.cryptoRandom = cryptoRandom.default
  _.glob = require('glob')
  _.crc = require('crc')
  _.simpleHash = str => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash &= hash // Convert to 32bit integer
    }
    return new Uint32Array([hash])[0].toString(36)
  }
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
    om,
    moment,
    _,
    s,
    $,
    shelljs
  }
}

async function getClusterName (cfgutil) {
  const realPath = await fs.realpath(cfgutil.path('config', 'active'))
  // console.log('realPath=', realPath)
  return path.basename(realPath)
}

async function regSwagger (fastify, isDev, opts) {
  const { _ } = fastify
  if (isDev || opts.swagger) {
    const conf = (opts.swagger && _.isObject(opts.swagger.conf)) ? opts.swagger.conf : {}
    // swagger需要提前注册.否则可能会丢失route信息.
    await fastify.register(require('@fastify/swagger'), _.merge({
      swagger: {
        info: {
          title: 'API文档',
          description: 'API文档',
          version: '0.0.1'
        },
        externalDocs: {
          url: 'https://swagger.io',
          description: '访问swagger官网'
        },
        host: '127.0.0.1:3000',
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'default', description: '未分组的end-points' },
          { name: 'public', description: '用户无关的end-points' },
          { name: 'user', description: '用户相关的end-points' }
        ],
        securityDefinitions: {
          apiKey: {
            type: 'apiKey',
            name: 'apiKey',
            in: 'header'
          }
        }
      }
    }, conf)
    )

    if (isDev || opts.swaggerui) {
      const conf = (opts.swaggerui && _.isObject(opts.swaggerui.conf)) ? opts.swaggerui.conf : {}
      // swagger需要提前注册.否则可能会丢失route信息.
      await fastify.register(require('@fastify/swagger-ui'), _.merge({
        routePrefix: '/documentation',
        uiConfig: {
          docExpansion: 'full',
          deepLinking: false
        },
        uiHooks: {
          onRequest: function (request, reply, next) { next() },
          preHandler: function (request, reply, next) { next() }
        },
        staticCSP: true,
        transformStaticCSP: (header) => header,
        transformSpecification: (swaggerObject, request, reply) => { return swaggerObject },
        transformSpecificationClone: true
      }, conf))
    }
  }
}

async function decorate (fastify, opts = {}) {
  if (!global.fastify) { // 将fastify放入global名称空间中．
    global.fastify = fastify
  }
  const util = await getUtil(fastify.config)
  fastify.decorate('_', util._)

  const clusterName = await getClusterName(fastify.config.util)
  util.s.clusterName = clusterName
  fastify.decorate('s', util.s)

  fastify.decorate('moment', util.moment)

  fastify.decorate('om', util.om)

  if (util._.isObject(opts.fastify) && util._.isString(opts.fastify.domain)) {
    const domainArray = opts.fastify.domain.split(' ').map(e => util.s.trim(e))
    // console.log("domainArray=", domainArray)
    let redirectDomain = domainArray[0]
    for (let i = 0; i < domainArray.length; i++) {
      if (!net.isIP(domainArray[i])) {
        redirectDomain = domainArray[i]
        break
      }
    }
    const s = util.s
    fastify.decorate('domain', redirectDomain)
    fastify.addHook('onRequest', (request, reply, done) => {
      const host = s.trim(s.strLeft(request.hostname, ':'))
      // console.log("request host=", host)
      if (domainArray.indexOf(host) < 0) {
        reply.redirect(301, request.protocol + '://' + redirectDomain + request.url)
        // throw new error.BadRequestError('请使用合法域名访问.')
      } else {
        done()
      }
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

  await regSwagger(fastify, clusterName === 'dev', opts)

  await extUtil.ext(fastify)
  await bootstrap.setup(fastify, opts)
  if (soa.has('knex')) {
    await fastify.util.model(path.join(__dirname, 'soa', 'services', 'cmds', 'models'))

    fastify.log.info('开始加载src/helper/models中定义的数据库模型')
    // 不能放在knex中加载，会引发objection互相等待的死锁．
    await fastify.util.model(path.join(fastify.dirname, 'src', 'helper', 'models'))
  }
  // 开始扫描本地的gpl服务目录．
  if (clusterName === 'dev' && soa.has('gql')) {
    const gql = await soa.get('gql')
    await gql.scan(path.join(__dirname, 'lib', 'dev', 'gql'))
  }
}

// 首次调用验证才会执行到这里，为ajv添加validator.js中的format.
function ajvPlugin (ajv, opts) {
  // console.error('NOT IMPLEMENT:(add validator.js format to ajv)call into ajvPlugin')
}

module.exports.decorate = decorate
module.exports.ajvPlugin = ajvPlugin
module.exports.getUtil = getUtil
