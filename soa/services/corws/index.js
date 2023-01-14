/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 14 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: index

/**
 * 基于[fastify-websocket](https://github.com/fastify/fastify-websocket)及[mqemitter](https://github.com/mcollina/mqemitter)
 * 构建的push通路．不同于socket.io,此实现确保服务器stateless，无需sticky.
 * 由客户端保存状态，而不是服务器．
 * 客户端通过request-response通路获取到签名的资源号，并缓冲起来．
 * [重新]连接后，请求监听这些资源，服务器对签名验证通过后，通过mqemitter监听资源(subject)并通知客户端．
 * 没有其它处理．也没有身份验证，这些依赖request-response通路．
 */
module.exports.load = async function (fastify, sdl = {}) {
  const { _ } = fastify
  const options = _.isObject(sdl.conf) ? _.cloneDeep(sdl.conf) : {}
  const routeOpts = _.isObject(sdl.route) ? _.cloneDeep(sdl.route) : {}
  const opts = {
    errorHandler: function (error, conn /* SocketStream */, req /* FastifyRequest */, reply /* FastifyReply */) {
      // Do stuff
      // destroy/close connection
      fastify.log.warn('corws: error:', error)
      conn.destroy(error)
    },
    options
  }
  options.verifyClient = function (info, next) {
    // if (info.req.headers['x-fastify-header'] !== 'fastify is awesome !') {
    //   return next(false) // the connection is not allowed
    // }
    // console.log('corws: verifyClient=', info)
    next(true) // the connection is allowed
  }

  options.maxPayload = options.maxPayload || 1048576 // we set the maximum allowed messages size to 1 MiB (1024 bytes * 1024 bytes)
  // console.log('fastify/websocket opts=', opts)

  await fastify.register(require('@fastify/websocket'), opts)

  routeOpts.path = routeOpts.path || '/ws'
  // await fastify.register(async function (fastify) {
  fastify.get(routeOpts.path, { websocket: true }, (connection /* SocketStream */, req /* FastifyRequest */) => {
    console.log('request.session=', req.session)
    connection.socket.on('message', message => {
      // message.toString() === 'hi from client'
      connection.socket.send('hi from wildcard route')
    })
  })
  // })
  return { inst: {} }
}
