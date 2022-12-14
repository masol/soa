/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 6 Nov 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: index

const Manager = require('./manage')

async function load (fastify, sdl = {}) {
  // console.log('Manager=', Manager)
  const inst = new Manager(fastify, sdl.conf)
  // console.log('inst=', inst.load)
  return { inst }
}

module.exports.load = load
