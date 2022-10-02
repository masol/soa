/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 23 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: index

const fs = require('fs').promises
const forwarded = require('@fastify/forwarded')

module.exports.ext = async function (fastify) {
  const { $, log } = fastify
  const util = {
    model: async (base) => {
      const { soa } = fastify
      const ojs = await soa.get('objection')
      const files = await $.glob(`${base}/**/*.js`)
      for (let i = 0; i < files.length; i++) {
        try {
          const m = require(files[i])
          await m.setup(fastify, ojs)
        } catch (e) {
          log.error("加载Model'%s'时发生错误:%s", files[i], e)
        }
      }
    },
    schema: async (base) => {
      const { $, log } = fastify
      const loader = async (fullpath) => {
        const content = await fs.readFile(fullpath, 'utf-8')
        const schema = JSON.parse(content)
        return fastify.addSchema(schema)
      }
      const tasks = []
      const files = await $.glob(`${base}/**/*.json`)
      for (let i = 0; i < files.length; i++) {
        tasks.push(loader(files[i]))
      }
      return await Promise.all(tasks).catch(e => {
        log.error('加载Schema时发生错误:%s', e)
      })
    },

    route: async (base) => {
      const { $, log } = fastify
      const tasks = []
      const files = await $.glob(`${base}/**/*.js`)
      for (let i = 0; i < files.length; i++) {
        // console.log(`file ${i} = ${files[i]}`)
        try {
          const m = require(files[i])
          tasks.push(m(fastify))
        } catch (e) {
          log.error("加载Route'%s'时发生错误:%s", files[i], e)
        }
      }
      return await Promise.all(tasks).catch(e => {
        log.error('加载Route时发生错误:%s', e)
      })
    },
    forwarded
  }

  fastify.decorate('util', util)
}
