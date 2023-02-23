/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 5 Feb 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: workflow
const crypto = require('crypto')

const topic = 'workflow'
async function setup (fastify) {
  const { soa, _ } = fastify
  const lowdb = await soa.get('lowdb')
  console.log('low=', lowdb)
  let corsws
  return {
    Query: {
      workflows: async (parent, args, ctx, info) => {
        const db = await lowdb.get('pvdev/workflows.json')
        console.log('db.data=', db.data)
        corsws = corsws || await soa.get('corsws')
        await corsws.setLive(ctx.__currentQuery, topic, ctx.reply, -2)
        return db.data || []
      }
    },
    Mutation: {
      updWorkflow: async (parent, args, ctx, info) => {
        const db = await lowdb.get('pvdev/workflows.json')
        try {
          const objArgs = JSON.parse(args.json)
          let oldVal
          console.log('objArgs=', objArgs)
          if (objArgs.id) {
            oldVal = db.chain.find({ id: objArgs.id }).value()
          } else {
            objArgs.id = crypto.randomUUID()
          }

          if (oldVal) {
            _.assign(oldVal, objArgs)
          } else {
            db.data.push(objArgs)
          }
          // console.log('args=', args)
          // console.log('vals=', oldVal)
          const diff = {}
          diff[oldVal ? 'upd' : 'add'] = objArgs
          // console.log('db.data=', db.data)
          db.write()
          corsws = corsws || await soa.get('corsws')
          corsws.update(topic, diff, true)
          return true
        } catch (e) {
          console.error('error=', e)
          return false
        }
      },
      rmWorkflow: async (parent, args, ctx, info) => {
        const db = await lowdb.get('pvdev/workflows.json')
        try {
          const rmId = args.id
          console.log('rmId=', rmId)
          const rmVal = db.chain.remove({ id: rmId }).value()
          console.log('rmVal=', rmVal)
          db.write()
          corsws = corsws || await soa.get('corsws')
          corsws.update(topic, {
            rm: {
              id: args.id
            }
          }, true)
          return true
        } catch (e) {
          console.error('error=', e)
          return false
        }
      }
    }
  }
}

module.exports = setup
