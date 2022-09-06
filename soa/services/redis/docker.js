/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 6 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: docker

const path = require('path')
const imageTag = 'redis:7.0.4'
const tagName = 'pv-redis'

async function findContainer (_, docker) {
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

async function deploy (fastify, sdl = {}) {
  const { soa, _, $, log, config } = fastify
  const cfgutil = config.util
  const docker = await soa.get('docker')
  if (!docker) {
    return false
  }
  let container = await findContainer(_, docker)
  if (!container) {
    const volumeBase = cfgutil.path('config', 'active', 'redis', 'volumes')
    const images = await docker.listImages().catch(e => {
      log.error('docker can not get image list: %s', e)
    })
    const imageInfo = _.find(images, (v) => { return v && v.RepoTags && v.RepoTags && v.RepoTags.indexOf(imageTag) >= 0 })
    // log.debug('imageInfo=%o', imageInfo)
    if (!imageInfo) {
      const pullImg = async () => {
        return new Promise((resolve, reject) => {
          docker.pull(imageTag, (err, stream) => {
            if (err) {
              reject(err)
            }
            stream.on('data', (chunk) => log.debug(Buffer.from(chunk).toString('utf-8')))
            stream.on('error', (err) => reject(err))
            stream.on('end', () => {
              resolve()
            })
          })
        })
      }
      await pullImg()
    }

    // log.debug('images=%o', images)
    log.debug('map redis data to host dir="%s"', path.join(volumeBase, 'data'))
    container = await docker.createContainer({
      Image: imageTag,
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: true,
      Tty: false,
      name: tagName,
      Labels: {
        'com.prodvest.project': tagName
      },
      RestartPolicy: {
        Name: 'always',
        MaximumRetryCount: 0
      },
      Cmd: ['redis-server', '--save 60 1', '--loglevel warning'],
      HostConfig: {
        PortBindings: {
          '6379/tcp': [
            {
              HostPort: '6379'
            }
          ]
        },
        Binds: [
          `${path.join(volumeBase, 'data')}:/data`
        ]
      }
    }).catch(e => {
      log.error('create redis Container error:%s', e)
      return null
    })
  }

  if (!container) {
    const msg = '无法获取或创建redis的docker容器'
    log.error(msg)
    return false
  }

  const containerInfo = await container.inspect().catch(e => {
    return null
  })
  // log.debug('container inspect info=%o', containerInfo)

  if (!containerInfo || !containerInfo.State || !containerInfo.State.Running) {
    // console.log('container.start=', container.start)
    log.debug('start redis container...')
    await $.retry(_.bindKey(container, 'start'), { maxAttempts: 5, delayMs: 1000 })().catch(e => {
      log.error('start redis error:%s', e)
    })
    await $.delay(1000)
  }

  return true
}

module.exports.deploy = deploy
