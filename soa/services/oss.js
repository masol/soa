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

async function ensureBucket (s3, bucket) {
  const data = await s3.listBuckets({}).promise()
  // console.log('list buket, data:', data)
  if (data.Buckets.indexOf(bucket.Bucket) < 0) {
    await s3.createBucket(bucket).promise()
    // console.log('create Bucket ret:', data)
    // await s3.putObject({
    //   Bucket: bucket.Bucket,
    //   ACL: 'public-read',
    //   Key: 'index.html',
    //   Body: 'this is a test',
    //   ContentType: 'text/html'
    // }).promise()
  }
}

async function load (fastify, sdl = {}) {
  const { log } = fastify
  const pkg = sdl.package || 'aws-sdk'
  const AWS = await fastify.shell.require(pkg)
  if (pkg === 'aws-sdk') {
    const conf = sdl.conf || {}
    conf.accessKeyId = conf.accessKeyId || 'lifecycleKey1'
    conf.secretAccessKey = conf.secretAccessKey || 'lifecycleSecretKey1'
    conf.endpoint = conf.endpoint || 'localhost:8000'
    conf.region = conf.region || 'us-east-1'
    if (typeof conf.sslEnabled === 'undefined') {
      conf.sslEnabled = false
    }
    if (typeof conf.s3ForcePathStyle === 'undefined') {
      conf.s3ForcePathStyle = true
    }
    AWS.config.update(conf)
    let s3 = new AWS.S3({ })
    const bucket = sdl.bucket || {}
    bucket.Bucket = 'default'
    bucket.ACL = 'public-read'
    await ensureBucket(s3, bucket).catch(e => {
      log.error('无法连接OSS服务:%s', e)
      s3 = null
    })
    return { inst: s3 }
  } else {
    log.error('尚未支持的OSS Package:%s', pkg)
  }
  return { inst: null }
}

module.exports.load = load
