/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 5 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: docker

const path = require('path')
const fs = require('fs').promises
const imageTag = 'elasticsearch:8.4.1'
const tagName = 'pv-elastic'

const getPasswdPath = (cfgutil) => {
  return cfgutil.path('config', 'active', 'elastic', 'passwd')
}

const getCAPath = (cfgutil) => {
  return cfgutil.path('config', 'active', 'elastic', 'http_ca.crt')
}

async function espasswd (container, log) {
  return new Promise((resolve, reject) => {
    container.exec({
      Cmd: ['/usr/share/elasticsearch/bin/elasticsearch-reset-password', '-u', 'elastic', '-f', '-s', '-a'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true
    }, function (err, exec) {
      if (err) {
        reject(err)
      }
      // log.debug('get exec:%o', exec)
      exec.start({ Tty: true, stdin: true }, function (err, stream) {
        if (err) {
          reject(err)
        }
        // let bConfirm = false
        let passwd = ''
        // log.debug('get stream', stream)
        stream.write('y\n')
        stream.on('data', (chunk) => {
          const data = Buffer.from(chunk).toString('utf-8')
          // if (bConfirm) {
          //   passwd = data
          //   log.debug(data)
          //   resolve(passwd)
          // }
          // if (!bConfirm && /Please confirm that you would like to continue \[y\/N\]/.test(data)) {
          //   bConfirm = true
          //   stream.write('y\n')
          // }
          passwd = String(data).trim()
        })
        stream.on('error', (err) => reject(err))
        stream.on('end', () => {
          if (passwd) {
            log.debug('elastic reset password to="%s"', passwd)
            resolve(passwd)
          } else {
            reject(new Error('not ready'))
          }
        })
      })
    })
  })
}

/**
 * 重置elastic容器的elastic用户的密码，保存在配置文件中。
 * @param {import('fastify').FastifyContext} fastify
 * @return {string} 新密码。
 */
async function resetPasswd (fastify) {
  const { log, config, $ } = fastify
  const cfgutil = config.util
  const container = await findContainer(fastify)
  if (!container) {
    const msg = '无法获取或创建elastic的docker容器'
    log.error(msg)
    return false
  }
  let passwd = await $.retry(espasswd, { maxAttempts: 15, delayMs: 1000 })(container, log).catch(e => {
    fastify.log.error('elastic reset password错误:%s', e)
    return false
  })
  // log.debug('elastic reset password to %s', passwd)
  if (passwd) {
    const passwdPath = getPasswdPath(cfgutil)
    await fs.writeFile(passwdPath, passwd).catch(e => {
      passwd = false
    })
  }
  return passwd
}

async function esgetca (container, log) {
  return new Promise((resolve, reject) => {
    container.exec({
      Cmd: ['cat', '/usr/share/elasticsearch/config/certs/http_ca.crt'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true
    }, function (err, exec) {
      if (err) {
        reject(err)
      }
      exec.start({ Tty: true, stdin: true }, function (err, stream) {
        if (err) {
          reject(err)
        }
        let certCtx = ''
        stream.on('data', (chunk) => {
          const data = Buffer.from(chunk).toString('utf-8')
          certCtx += data
        })
        stream.on('error', (err) => reject(err))
        stream.on('end', () => {
          certCtx = String(certCtx).trim()
          log.debug('elastic get cert Content to="%s"', certCtx)
          resolve(certCtx)
        })
      })
    })
  })
}

async function getCA (fastify) {
  const { log, config } = fastify
  const cfgutil = config.util
  const container = await findContainer(fastify)
  if (!container) {
    const msg = '无法获取或创建elastic的docker容器'
    log.error(msg)
    return false
  }
  let cactx = await esgetca(container, log)
  log.debug('elastic get ca content to %s', cactx)
  if (cactx) {
    const caPath = getCAPath(cfgutil)
    await fs.writeFile(caPath, cactx).catch(e => {
      cactx = false
    })
  }
  return cactx
}

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
    const volumeBase = cfgutil.path('config', 'active', 'elastic', 'volumes')
    const images = await docker.listImages().catch(e => {
      log.error('can not get image list: %s', e)
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
    log.debug('map elastic data to host dir="%s"', path.join(volumeBase, 'data'))
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
      Env: [
        'discovery.type=single-node',
        'ES_JAVA_OPTS=-Xms512m -Xmx512m'
      ],
      HostConfig: {
        PortBindings: {
          '9200/tcp': [
            {
              HostPort: '9200'
            }
          ],
          '9300/tcp': [
            {
              HostPort: '9300'
            }
          ]
        },
        Binds: [
          `${path.join(volumeBase, 'data')}:/usr/share/elasticsearch/data`,
          // `${path.join(volumeBase, 'certs')}:/usr/share/elasticsearch/config/certs`,
          `${path.join(volumeBase, 'logs')}:/usr/share/elasticsearch/logs`
        ]
      }
    }).catch(e => {
      log.error('create elastic Container error:%s', e)
      return null
    })
  }

  if (!container) {
    const msg = '无法获取或创建elastic的docker容器'
    log.error(msg)
    return false
  }

  const containerInfo = await container.inspect().catch(e => {
    return null
  })
  // log.debug('container inspect info=%o', containerInfo)

  // await container.kill().catch(e => {
  //   log.error('kill elastic error:%s', e)
  //   return false
  // })

  if (!containerInfo || !containerInfo.State || !containerInfo.State.Running) {
    // console.log('container.start=', container.start)
    log.debug('start elastic container...')
    await $.retry(_.bindKey(container, 'start'), { maxAttempts: 5, delayMs: 1000 })().catch(e => {
      log.error('start elastic error:%s', e)
    })
    await $.delay(3000)

    await fs.access(getPasswdPath(cfgutil), fs.F_OK).catch(async e => {
      await resetPasswd(fastify)
    })

    await fs.access(getCAPath(cfgutil), fs.F_OK).catch(async e => {
      await getCA(fastify)
    })
  }

  return true
}

module.exports.deploy = deploy
