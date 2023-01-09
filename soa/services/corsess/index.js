/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 7 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: index

const SessMan = require('./sessman')

function extractToken (request) {
  const { error } = global.fastify
  let token
  if (request.headers && request.headers.authorization) {
    const parts = request.headers.authorization.split(' ')
    if (parts.length === 1) {
      token = request.headers.authorization
    } else if (parts.length === 2) {
      const scheme = parts[0]
      token = parts[1]
      if (!/^Bearer$/i.test(scheme)) {
        throw new error.BadRequestError()
      }
    }
  } else { // @TODO: 开始检查queryString

  }
  if (!token) {
    throw new error.BadRequestError()
  }
  return token
}

module.exports.load = async function (fastify, sdl = {}) {
  const { _, soa } = fastify
  const conf = _.isObject(sdl.conf) ? _.cloneDeep(sdl.conf) : {}
  if (_.isObject(conf.secret)) {
    const vault = await soa.get('vault')
    const readVault = async (keyName) => {
      if (_.isObject(conf.secret[keyName])) {
        conf.secret[keyName].key = await vault.read(conf.secret[keyName].key)
      } else if (_.isString(conf.secret[keyName])) {
        conf.secret[keyName] = await vault.read(conf.secret[keyName])
      }
    }
    await readVault('private')
    await readVault('public')
  }
  const inst = new SessMan(sdl.session)
  await inst.init(fastify)
  conf.decoratorName = 'session'
  // 将result中的session返回．要求在trust时设置此成员．
  conf.formatUser = (result) => result.session
  conf.trusted = async (request, decodedToken) => {
    // console.log('decodedToken=', decodedToken)
    return await inst.$validToken(request, decodedToken)
  }
  conf.verify = {
    errorCacheTTL: 600000,
    extractToken
  }
  const jwt = require('@fastify/jwt')
  await fastify.register(jwt, conf)
  // 这已经在jwt中decorator了．
  // fastify.decorateRequest('session', null)
  return { inst }
}
