/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 7 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: util

async function findContainer (_, docker, tagName) {
  const containers = await docker.listContainers({ all: true })
  // log.debug('containers=%o', containers)
  const containerInfo = _.find(containers, (v) => { return v && v.Labels && v.Labels['com.prodvest.project'] === tagName })
  if (containerInfo) {
    // log.debug('old containerInfo=%o', containerInfo)
    return await docker.getContainer(containerInfo.Id)
    // log.debug('container=%o', container)
  }
  return null
}

async function pullImg (docker, imageTag, log) {
  return new Promise((resolve, reject) => {
    docker.pull(imageTag, (err, stream) => {
      if (err) {
        reject(err)
      }
      stream.on('data', (chunk) => log && log.debug(Buffer.from(chunk).toString('utf-8')))
      stream.on('error', (err) => reject(err))
      stream.on('end', () => {
        resolve()
      })
    })
  })
}

module.exports.findContainer = findContainer
module.exports.pullImg = pullImg
