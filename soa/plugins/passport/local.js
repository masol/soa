/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 14 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: local

module.exports = async function (fastify, passport, conf) {
  // console.log('passport.module.Strategy=', passport.module.Strategy)
  const { shell } = fastify
  const LocalStrategy = await shell.import('passport-local')
  // console.log('LocalStrategy=', LocalStrategy)
  passport.use('local', new LocalStrategy.Strategy(async function (username, password, done) {
    console.log('local login=', username, passport)
    const row = { username: 'test', role: ['a', 'b', 'c'] }
    done(null, row)
    console.log('after cb!!')
  }))
  //
}
