/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                               //
//                                                                         //
//  WIDE website: http://www.wware.org/                                    //
//  WIDE website: http://www.prodvest.com/                                 //
//  License : WWARE LICENSE(https://www.wware.org/license.html)            //
/// /////////////////////////////////////////////////////////////////////////
// Created On : 7 Sep 2022 By 李竺唐 of SanPolo.Co.LTD
// File: docker

const fs = require('fs').promises
const path = require('path')
const util = require('../util')
const imageTag = 'postgres:14.5'
const tagName = 'pv-postgres'

async function setUserpwd (fastify, container, userpwd) {
  const { log } = fastify
  return new Promise((resolve, reject) => {
    container.exec({
      Cmd: ['psql', '-U', 'postgres'],
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
        log.debug('pg get stream', stream)
        const cmds = [
          `CREATE USER keycloak with encrypted password '${userpwd}';\n`,
          'CREATE DATABASE keycloak;\n',
          'GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;\n',
          '\\q\n'
        ]
        const cmd = cmds.shift()
        stream.write(cmd)
        stream.on('data', (chunk) => {
          const data = Buffer.from(chunk).toString('utf-8')
          log.debug('pgsql:%s', data)
          if (cmds.length > 0) {
            const cmd = cmds.shift()
            log.debug('pg cmd=%s', cmd)
            stream.write(cmd)
            // stream.write('\n')
          } else {
            reject(new Error('no commands!'))
          }
        })
        stream.on('error', (err) => reject(err))
        stream.on('end', () => {
          // log.debug('stream end???%o', arguments)
          resolve()
        })
      })
    })
  })
}

async function deploy (fastify, cfg = {}) {
  const { soa, _, $, log, config } = fastify
  const cfgutil = config.util
  const docker = await soa.get('docker')
  if (!docker) {
    return false
  }
  const pgdir = cfgutil.path('config', 'active', 'postgres')
  let container = await util.findContainer(_, docker, tagName)
  if (!container) {
    const images = await docker.listImages().catch(e => {
      log.error('docker can not get image list: %s', e)
    })
    const imageInfo = _.find(images, (v) => { return v && v.RepoTags && v.RepoTags && v.RepoTags.indexOf(imageTag) >= 0 })
    // log.debug('imageInfo=%o', imageInfo)
    if (!imageInfo) {
      await util.pullImg(docker, imageTag, log)
    }

    // log.debug('images=%o', images)
    const volumeBase = path.join(pgdir, 'volumes')
    // console.log('postgres cfg=', cfg)
    const conncfg = cfg.connection || {}
    log.debug('map postgres data to host dir="%s"', path.join(volumeBase, 'data'))
    const PortBindings = { }
    PortBindings[`${conncfg.port || 5432}/tcp`] = [
      {
        HostPort: '5432'
      }
    ]
    let passwd = conncfg.password
    if (!passwd) {
      passwd = _.cryptoRandom({ length: 16 })
      await fs.writeFile(path.join(pgdir, 'passwd'), passwd)
    }
    const Env = [
      `POSTGRES_USER=${conncfg.user || 'postgres'}`,
      `POSTGRES_PASSWORD=${passwd}`,
      `POSTGRES_DB=${conncfg.database || 'app'}`
    ]
    log.debug('postgres Env=%o', Env)
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
      Env,
      HostConfig: {
        PortBindings,
        Binds: [
          `${path.join(volumeBase, 'data')}:/var/lib/postgresql/data`
        ]
      }
    }).catch(e => {
      log.error('create postgres Container error:%s', e)
      return null
    })
  }

  if (!container) {
    const msg = '无法获取或创建postgres的docker容器'
    log.error(msg)
    return false
  }

  const containerInfo = await container.inspect().catch(e => {
    return null
  })
  // log.debug('container inspect info=%o', containerInfo)

  if (!containerInfo || !containerInfo.State || !containerInfo.State.Running) {
    // console.log('container.start=', container.start)
    log.debug('start postgres container...')
    await $.retry(_.bindKey(container, 'start'), { maxAttempts: 5, delayMs: 1000 })().catch(e => {
      log.error('start postgres error:%s', e)
    })
    await $.delay(1000)
    const userpwdfile = path.join(pgdir, 'user.passwd')
    await fs.access(userpwdfile, fs.F_OK).catch(async e => {
      const userpwd = _.cryptoRandom({ length: 16 })
      await fs.writeFile(userpwdfile, userpwd)
      await setUserpwd(fastify, container, userpwd)
    })
  }

  return true
}

module.exports.deploy = deploy
