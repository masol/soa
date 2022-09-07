
const imageTag = 'bitnami/keycloak:19.0.1'
const tagName = 'pv-keycloak'

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
  const { soa, _, $, log } = fastify
  const docker = await soa.get('docker')
  if (!docker) {
    return false
  }
  let container = await findContainer(_, docker)
  if (!container) {
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

    const cmdenv = []
    const kconf = sdl.kconf
    cmdenv.push(`KEYCLOAK_ADMIN=${kconf.superuser}`)
    cmdenv.push(`KEYCLOAK_ADMIN_PASSWORD=${kconf.password}`)

    const Cmd = ['start']
    if (kconf.db) {
      Cmd.push(`--db=${kconf.db}`)
    }
    if (kconf.features) {
      Cmd.push(`--features=${kconf.features}`)
    }
    if (kconf['db-url']) {
      Cmd.push(`--db-url=${kconf['db-url']}`)
    }
    if (kconf['db-username']) {
      Cmd.push(`--db-username=${kconf['db-username']}`)
    }
    if (kconf['db-password']) {
      Cmd.push(`--db-password=${kconf['db-password']}`)
    }
    if (kconf['https-key-store-file']) {
      Cmd.push(`--https-key-store-file=${kconf['https-key-store-file']}`)
    }
    if (kconf['https-key-store-password']) {
      Cmd.push(`--https-key-store-password=${kconf['https-key-store-password']}`)
    }
    // log.debug('images=%o', images)
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
      Env: cmdenv,
      Cmd,
      HostConfig: {
        PortBindings: {
          '8080/tcp': [
            {
              HostPort: '8080'
            }
          ]
        }
      }
    }).catch(e => {
      log.error('create keycloak Container error:%s', e)
      return null
    })
  }

  if (!container) {
    const msg = '无法获取或创建keycloak的docker容器'
    log.error(msg)
    return false
  }

  const containerInfo = await container.inspect().catch(e => {
    return null
  })
  // log.debug('container inspect info=%o', containerInfo)

  if (!containerInfo || !containerInfo.State || !containerInfo.State.Running) {
    // console.log('container.start=', container.start)
    log.debug('start keycloak container...')
    await $.retry(_.bindKey(container, 'start'), { maxAttempts: 5, delayMs: 1000 })().catch(e => {
      log.error('start keycloak error:%s', e)
    })
    await $.delay(3000)
  }

  return true
}

module.exports.deploy = deploy
