/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 16 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: push

const TABLENAME = 'push'

module.exports.setup = async function (fastify, ojs) {
  const { _ } = fastify
  class Push extends ojs.Model {
    static get tableName () {
      return TABLENAME
    }

    static get modifiers () {
      return {
        topic (builder, args = {}) {
          if (args.topic && _.isString(args.topic)) {
            builder.where('topic', args.topic)
            // console.log('query suc=', builder)
            if (_.isNumber(args.last) && args.last >= -1) {
              builder.where('id', '>', args.last)
              // console.log('query limit=', builder)
            }
          }
          builder.orderBy('id', 'asc')
        },
        last (builder, topic) {
          builder.where('topic', topic).orderBy('id', 'desc').limit(1)
        }
      }
    }

    /**
     * 推送一条消息．并返回包含id，时间戳在内的全信息格式．
     */
    static async push (topic, msg) {
      const result = await Push.query().insert({
        topic,
        message: _.isString(msg) ? msg : JSON.stringify(msg)
      })
      return result
    }
  }
  ojs.Model.store[TABLENAME] = Push
}
