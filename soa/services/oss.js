/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 11 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: oss

async function ensureBucket (s3, Bucket) {
  return new Promise((resolve, reject) => {
    s3.listBuckets({}, function (err, data) {
      console.log('list buket:', err)
      console.log('list buket, data:', data)
      if (err) {
        reject(err)
      } else {
        if (data.Buckets.indexOf(Bucket) < 0) {
          s3.createBucket({
            Bucket,
            ACL: 'public-read'
          }, (err, data) => {
            if (err) {
              reject(err)
            } else {
              console.log(data)
              s3.putObject({
                Bucket,
                ACL: 'public-read',
                Key: 'index.html',
                Body: 'this is a test',
                ContentType: 'text/html'
              }, (err, data) => {
                err ? reject(err) : resolve(data)
              })
              resolve(data)
            }
          })
        } else {
          resolve(data)
        }
      }
    })
  })
}

async function load (fastify, sdl = {}) {
  // const { log } = fastify
  // const pkg = sdl.package || 'aws-sdk'
  const AWS = await fastify.shell.require('aws-sdk')
  AWS.config.update({
    accessKeyId: 'lifecycleKey1',
    secretAccessKey: 'lifecycleSecretKey1',
    endpoint: 'localhost:8000',
    region: 'us-east-1'
  })
  const s3 = new AWS.S3({
    sslEnabled: false,
    s3ForcePathStyle: true
  })
  // console.log('s3=', s3)
  await ensureBucket(s3, 'test5')
  return { inst: s3 }
}

module.exports.load = load
