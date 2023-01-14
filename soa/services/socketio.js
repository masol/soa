/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 11 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: socketio

/**
 * socketio的两个问题：
 * １．支持polling需要lbs sticky支持，对lbs有限制．而websocket无此要求．
 * 2. 需要支持的只是一个push通信．针对命名资源进行push即可．基于fastify/websocket及mqemitter-redis的实现更有效．
 * 虽然可用，不推荐使用socketio．
 */
module.exports.load = async function (fastify, sdl = {}) {
  const { _ } = fastify
  const opts = _.isObject(sdl.conf) ? _.cloneDeep(sdl.conf) : {}
  opts.cors = opts.cors || {}
  if (!opts.cors.origin) {
    opts.cors.origin = true
    // opts.cors.allowedHeaders = ['']
    // opts.cors.methods = ["GET", "POST", "PUT", "PATCH", "DELETE"]
    opts.cors.credentials = false
  }
  if (_.has(opts, 'serveClient')) {
    opts.serveClient = false
  }
  // opts.allowEIO3 = true
  // opts.wsEngine = 'eiows'
  opts.allowRequest = async (req, callback) => {
    console.log('call into allowRequest:', req)
    callback(null, true)
  }
  opts.transports = ['websocket', 'polling']
  console.log('socket.io options=', opts)
  const io = require('socket.io')(fastify.server, opts)

  const cluster = require('node:cluster')
  console.log('cluster.isPrimary=', cluster.isPrimary)
  if (!cluster.isPrimary) {
    const { createAdapter } = require('@socket.io/cluster-adapter')
    await io.adapter(createAdapter())
    const { setupWorker } = require('@socket.io/sticky')
    setupWorker(io)
    // const redis = require('socket.io-redis')
    // io.adapter(redis({ host: 'localhost', port: 6379 }))
  }

  fastify.decorate('io', io)
  fastify.addHook('onClose', (fastify, done) => {
    console.log('server on close for socket io')
    fastify.io.close()
    done()
  })

  // console.log('socketio =', io)
  // const { isMainThread } = require('worker_threads')
  // console.log('isMainThread=', isMainThread)
  fastify.addHook('onReady', function (done) {
    // Some code
    console.log('onReady!!!')
    io.on('connection', (socket) => {
      console.log('connetion comming...')
      // ...
    })

    const err = null
    done(err)
  })
  return { inst: io }
}
