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

const Session = require('./session')

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
  const inst = new Session()
  await inst.init(fastify)
  conf.decoratorName = 'session'
  // 将result中的session返回．要求在trust时设置此成员．
  conf.formatUser = (result) => result.session
  conf.trusted = async (request, decodedToken) => {
    // console.log('decodedToken=', decodedToken)
    return await inst.$validToken(request, decodedToken)
  }
  const jwt = require('@fastify/jwt')
  await fastify.register(jwt, conf)
  // 这已经在jwt中decorator了．
  // fastify.decorateRequest('session', null)
  return { inst }
}
