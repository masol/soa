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
const tagName = 'pv-vault'

async function deploy (fastify, sdl = {}) {
  const { _, log, config, soa } = fastify
  const cfgutil = config.util
  const docker = await soa.get('docker')
  if (!docker) {
    return false
  }
  const containers = await docker.listContainers({ all: true })
  const vaultContainerInfo = _.find(containers, (v) => { return v && v.Labels && v.Labels['com.prodvest.project'] === tagName })
  let vaultContainer
  if (vaultContainerInfo) {
    // log.debug('old vaultContainer=%o', vaultContainerInfo)
    vaultContainer = await docker.getContainer(vaultContainerInfo.Id)
  }

  if (!vaultContainer) {
    const volumeBase = cfgutil.path('config', 'active', 'vault', 'volumes')
    vaultContainer = await docker.createContainer({
      Image: 'vault',
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false,
      Tty: false,
      name: 'pv-vault',
      Labels: {
        'com.prodvest.project': tagName
      },
      RestartPolicy: {
        Name: 'always',
        MaximumRetryCount: 0
      },
      Cmd: [
        'vault',
        'server',
        '-config=/vault/config/vault.json'
      ],
      HostConfig: {
        PortBindings: {
          '8200/tcp': [
            {
              HostPort: '8200'
            }
          ]
        },
        Binds: [
          `${path.join(volumeBase, 'logs')}:/vault/logs`,
          `${path.join(volumeBase, 'file')}:/vault/file`,
          `${path.join(volumeBase, 'config')}:/vault/config`
        ],
        CapAdd: [
          'IPC_LOCK'
        ]
      }
    })
  }

  if (!vaultContainer) {
    const msg = '无法获取或创建vault的docker容器'
    log.error(msg)
    return false
  }

  // 无需按照https://github.com/apocas/dockerode/blob/master/examples/exec_running_container.js,以detach mode执行
  await vaultContainer.start()
  return true
}

module.exports.deploy = deploy
