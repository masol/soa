
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

  // 使用dock-compose命令行来部署。同时部署依赖的keycloak.
  // 但是需要使用dockerode来exec以创建新用户及数据库。
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
    console.log('kconf=', kconf)
    if (kconf.superuser) cmdenv.push(`KEYCLOAK_ADMIN=${kconf.superuser}`)
    if (kconf.password) cmdenv.push(`KEYCLOAK_ADMIN_PASSWORD=${kconf.password}`)
    if (kconf.manuser) cmdenv.push(`KEYCLOAK_MANAGEMENT_USER=${kconf.manuser}`)
    if (kconf.manpwd) cmdenv.push(`KEYCLOAK_MANAGEMENT_PASSWORD=${kconf.manpwd}`)

    if (kconf.host) cmdenv.push(`KEYCLOAK_DATABASE_HOST=${kconf.host}`)
    if (kconf.port) cmdenv.push(`KEYCLOAK_DATABASE_PORT=${kconf.port}`)
    if (kconf.name) cmdenv.push(`KEYCLOAK_DATABASE_NAME=${kconf.name}`)
    if (kconf.user) cmdenv.push(`KEYCLOAK_DATABASE_USER=${kconf.user}`)
    if (kconf.dbpwd) cmdenv.push(`KEYCLOAK_DATABASE_PASSWORD=${kconf.dbpwd}`)

    cmdenv.push('KEYCLOAK_HTTP_PORT=8080')
    cmdenv.push('KEYCLOAK_BIND_ADDRESS=127.0.0.1')

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
    log.debug('keycloak start ok')
    await $.delay(3000)
  }

  return true
}

module.exports.deploy = deploy
