/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 22 Dec 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: index

const { print } = require('graphql')
const gql = require('graphql-tag')
const path = require('path')
const { mergeTypeDefs, mergeResolvers } = require('@graphql-tools/merge')
const { loadFiles } = require('@graphql-tools/load-files')
const mercurius = require('mercurius')
const gqlogger = require('mercurius-logging')

// 没有采用类似[Nexus](https://github.com/graphql-nexus/nexus)的helper来维护schema及resolver.
// 这些文件假定由codegen创建,而不是手动书写.

class Qpl {
  #fastify
  #conf
  #logger
  #schemas
  #resolvers
  #loaders
  static inst = null
  static get (fastify, sdl = {}) {
    if (!Qpl.inst) {
      Qpl.inst = new Qpl(fastify, sdl)
    }
    return Qpl.inst
  }

  constructor (fastify, sdl = {}) {
    this.#fastify = fastify
    this.#conf = sdl.conf || {}
    this.#logger = sdl.logger || {}
    this.#schemas = []
    this.#resolvers = {}
    this.#loaders = {}
  }

  async #merge (targetName, values) {
    // const { _ } = this.#fastify
    // console.log('targetName=', targetName)
    // console.log('values=', values)
    switch (targetName) {
      case '#resolvers':
        values.unshift(this.#resolvers)
        // this.#resolvers = _.merge(this.#resolvers, value)
        this.#resolvers = mergeResolvers(values)
        break
      case '#loaders':
        // this.#loaders = _.merge(this.#loaders, value)
        values.unshift(this.#loaders)
        this.#loaders = mergeResolvers(values)
        break
      default:
        console.error('invalid TargetName=', targetName)
    }
  }

  async #assign (files, targetName) {
    // console.log('files=', files, targetName)
    const { $, log, _ } = this.#fastify
    const tasks = []
    const that = this
    for (let i = 0; i < files.length; i++) {
      try {
        const m = require(files[i])
        if ($.isFunction(m)) {
          const ret = m(that.#fastify)
          if ($.isPromise(ret)) {
            tasks.push(ret)
          } else if (_.isObject(ret)) {
            console.log(targetName, 'ret=', ret)
            that.#merge(targetName, [ret])
            // console.log(targetName, 'that.#resolvers=', that.#resolvers)
          } else {
            log.error('加载qpl %s时返回非对象:%s', files[i], ret)
          }
        } else if (_.isObject(m)) {
          that.#merge(targetName, [m])
        }
      } catch (e) {
        log.error("加载gql '%s'时发生错误:%s", files[i], e)
      }
    }
    if (tasks.length > 0) {
      const results = await Promise.all(tasks)
      that.#merge(targetName, results)
    }
  }

  async scanLoaders (baseDir) {
    const { $ } = this.#fastify
    const files = await $.glob(`${baseDir}/**/*.js`)
    await this.#assign(files, '#loaders')
  }

  async scanResolvers (baseDir) {
    const { $ } = this.#fastify
    const files = await $.glob(`${baseDir}/**/*.js`)
    await this.#assign(files, '#resolvers')
  }

  #pushgql (gqlStr, gqlFile) {
    const { log } = this.#fastify
    try {
      const gqlObj = gql(gqlStr)
      this.#schemas.push(gqlObj)
    } catch (e) {
      log.error("从'%s'加载Gql类型定义时发生错误:%s", gqlFile, e)
    }
  }

  async scanSchemas (baseDir) {
    const { $, log, _ } = this.#fastify
    const files = await $.glob(`${baseDir}/**/*.js`)
    // console.log(baseDir, 'scan types....', files)
    const tasks = []
    const taskFiles = []
    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i]
        const m = require(files[i])
        if ($.isFunction(m)) {
          const ret = m(this.#fastify)
          if (_.isString(ret)) {
            this.#pushgql(ret, file)
          } else if ($.isPromise(ret)) {
            tasks.push(ret)
            taskFiles.push(file)
          } else {
            log.error('加载qpl type %s时返回非字符串:%s', files[i], ret)
          }
        } else if (_.isString(m)) {
          this.#pushgql(m, file)
        }
      } catch (e) {
        log.error("加载gql type '%s'时发生错误:%s", files[i], e)
      }
    }
    if (tasks.length > 0) {
      const types = await Promise.all(tasks)
      for (let i = 0; i < types.length; i++) {
        this.#pushgql(types[i], taskFiles[i])
      }
    }
  }

  async scanGqls (baseDir) {
    const loadedFiles = await loadFiles(`${baseDir}/**/*.gql`)
    if (loadedFiles.length > 0) {
      this.#schemas = this.#fastify._.concat(this.#schemas, loadedFiles)
    }
    // console.log('loadedFiles=', loadedFiles)
  }

  async scan (baseDir = 'src/helper/gql') {
    baseDir = path.isAbsolute(baseDir) ? baseDir : path.join(this.#fastify.dirname, baseDir)
    await this.scanSchemas(path.join(baseDir, 'schemas'))
    await this.scanGqls(path.join(baseDir, 'schemas'))
    await this.scanResolvers(path.join(baseDir, 'resolvers'))
    await this.scanLoaders(path.join(baseDir, 'loaders'))
  }

  async start (options = {}) {
    const { _, log, soa } = this.#fastify
    const opts = _.merge({}, this.#conf, options)
    // console.log('this.#schemas=', this.#schemas)
    opts.schema = print(mergeTypeDefs(this.#schemas))
    // console.log('opts.schema=', opts.schema)
    // opts.schema = s.trim(this.#schemas.join('\n'))
    if (opts.schema) {
      // console.log('this.#resolvers=', this.#resolvers)
      opts.resolvers = this.#resolvers
      if (!_.isEmpty(this.#loaders)) {
        opts.loaders = this.#loaders
      }
      if (!_.has(opts, 'graphiql')) {
        const env = await soa.get('env')
        if (env.isDev()) { // 无条件启用graphiql
          opts.graphiql = true
        }
      }
      opts.context = opts.context || ((request, reply) => {
        // Return an object that will be available in your GraphQL resolvers
        return {
          request
        }
      })
      console.log('opts=', opts)
      await this.#fastify.register(mercurius, opts)
      if (!this.#logger.disabled) {
        await this.#fastify.register(gqlogger, this.#logger)
      }
    } else {
      log.warn('未指定任意GraphQL Schemas,禁用GraphQL支持.')
    }
  }
}

module.exports.load = function (fastify, sdl) {
  return { inst: Qpl.get(fastify, sdl) }
}
