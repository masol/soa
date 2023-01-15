/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 15 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: push

const PUSH = 'push'

module.exports = function (fastify, opts) {
  return {
    async up (knex) {
      await knex.schema
        .createTable(PUSH, function (table) {
          table.uuid('id', { primaryKey: true }).defaultTo(knex.raw('gen_random_uuid()'))
          // 资源名(主题名)
          table.string('topic', 128).index()
          // timestamp:iso秒数
          table.integer('timestamp').index()
          // 消息正文(json串，无需搜索)．
          table.text('message')
          // table.foreign('createdBy').references('user.id')
        })
    },
    async down (knex) {
      await knex.schema.dropTable(PUSH)
    }
  }
}
