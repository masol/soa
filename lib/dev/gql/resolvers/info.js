/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 7 Mar 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: info

const { remove, update } = require('./utils')

const infoTopic = 'info'
async function setup (fastify) {
  const { soa, _ } = fastify
  const lowdb = await soa.get('lowdb')
  // console.log('low=', lowdb)
  let corsws
  return {
    Query: {
      infos: async (parent, args, ctx, info) => {
        const db = await lowdb.get('pvdev/infos.json')
        // console.log('db.data=', db.data)
        corsws = corsws || await soa.get('corsws')
        await corsws.setLive(ctx.__currentQuery, infoTopic, ctx.reply, -2)
        return db.data || []
      }
    },
    Mutation: {
      updInfo: async (parent, args, ctx, info) => {
        const db = await lowdb.get('pvdev/infos.json')
        return await update({ json: args.json, db, corsws, topic: infoTopic, soa, _ })
      },
      rmInfo: async (parent, args, ctx, info) => {
        const db = await lowdb.get('pvdev/infos.json')
        return await remove({ soa, db, id: args.id, topic: infoTopic, corsws })
      }
    }
  }
}

module.exports = setup
