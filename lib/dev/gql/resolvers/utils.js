/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 7 Mar 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: libs

const crypto = require('crypto')

async function remove ({ soa, db, id, topic, corsws }) {
  try {
    const rmId = id
    console.log('rmId=', rmId)
    const rmVal = db.chain.remove({ id: rmId }).value()
    console.log('rmVal=', rmVal)
    db.write()
    corsws = corsws || await soa.get('corsws')
    corsws.update(topic, {
      rm: {
        id
      }
    }, true)
    return true
  } catch (e) {
    console.error('error=', e)
    return false
  }
}

async function update ({ json, db, corsws, topic, soa, _ }) {
  try {
    const objArgs = JSON.parse(json)
    let oldVal
    // console.log('objArgs=', objArgs)
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
}

module.exports.remove = remove
module.exports.update = update
