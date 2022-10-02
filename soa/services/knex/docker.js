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
const tagName = 'pv-postgres'

// function updcompose ({ kcdbpwd, kcpwd, kcmpwd }) {
//   return `version: '2'
// services:
//   postgresql:
//     image: bitnami/postgresql:14.5.0
//     container_name: pv-postgres
//     labels:
//       com.prodvest.project: "pv-postgres"
//     environment:
//       # ALLOW_EMPTY_PASSWORD is recommended only for development.
//       - POSTGRESQL_USERNAME=postgres
//       - POSTGRESQL_DATABASE=keycloak
//       - POSTGRESQL_PASSWORD=${kcdbpwd}
//     ports:
//       - "5432:5432"
//     volumes:
//       - 'pv_postgresql_data:/bitnami/postgresql'
//   keycloak:
//     image: bitnami/keycloak:19.0.1
//     container_name: pv-keycloak
//     labels:
//       com.prodvest.project: "pv-keycloak"
//     environment:
//       - KEYCLOAK_ADMIN_USER=admin
//       - KEYCLOAK_ADMIN_PASSWORD=${kcpwd}
//       - KEYCLOAK_MANAGEMENT_USER=keycloak
//       - KEYCLOAK_MANAGEMENT_PASSWORD=${kcmpwd}
//       - KEYCLOAK_DATABASE_NAME=keycloak
//       - KEYCLOAK_DATABASE_USER=postgres
//       - KEYCLOAK_DATABASE_PASSWORD=${kcdbpwd}
//     depends_on:
//       - postgresql
//     ports:
//       - "8080:8080"
// volumes:
//   pv_postgresql_data:
//     driver: local
// `
// }

function updcompose ({ appdbpwd }) {
  return `version: '2'
services:
  postgresql:
    image: bitnami/postgresql:14.5.0
    container_name: pv-postgres
    labels:
      com.prodvest.project: "pv-postgres"
    environment:
      # ALLOW_EMPTY_PASSWORD is recommended only for development.
      - POSTGRESQL_USERNAME=app
      - POSTGRESQL_DATABASE=app
      - POSTGRESQL_PASSWORD=${appdbpwd}
    ports:
      - "5432:5432"
    volumes:
      - 'pv_postgresql_data:/bitnami/postgresql'
volumes:
  pv_postgresql_data:
    driver: local
`
}

// async function setUserpwd (fastify, container, appdbpwd, kcdbpwd) {
//   const { log } = fastify
//   return new Promise((resolve, reject) => {
//     const params = `"postgresql://postgres:${kcdbpwd}@127.0.0.1/keycloak"`
//     // log.debug('run psql params=%s', params)
//     container.exec({
//       Cmd: ['psql', '-U', 'postgres'],
//       Tty: true,
//       AttachStdin: true,
//       AttachStdout: true,
//       AttachStderr: true
//     }, function (err, exec) {
//       if (err) {
//         reject(err)
//       }
//       // log.debug('get exec:%o', exec)
//       exec.start({ Tty: true, stdin: true }, async function (err, stream) {
//         if (err) {
//           reject(err)
//         }
//         // log.debug('pg get stream', stream)
//         const cmds = [
//           'CREATE DATABASE app;\n',
//           `CREATE USER app with encrypted password '${appdbpwd}';\n`,
//           'GRANT ALL PRIVILEGES ON DATABASE app TO app;\n',
//           '\\q\n',
//           '\n'
//         ]
//         // const cmd = cmds.shift()
//         // stream.write(cmd)
//         // await fastify.$.delay(1000)
//         // stream.write(`psql ${params}\r`)
//         // log.debug('command wite %s', kcdbpwd)
//         let inputPwd = false
//         stream.on('data', (chunk) => {
//           const data = Buffer.from(chunk).toString('utf-8')
//           log.debug('pgsql:%s', data)
//           if (!inputPwd) {
//             if (data && data.indexOf('Password for user') >= 0) {
//               stream.write(`${kcdbpwd}\n`)
//               inputPwd = true
//             }
//           } else {
//             if (cmds.length > 0) {
//               const cmd = cmds.shift()
//               // log.debug('pg cmd=%s', cmd)
//               stream.write(cmd)
//               // stream.write('\n')
//             }
//           }
//           // else {
//           //   reject(new Error('no commands!'))
//           // }
//         })
//         stream.on('error', (err) => reject(err))
//         stream.on('end', () => {
//           // log.debug('stream end???%o', arguments)
//           if (cmds.length) {
//             log.error(`无法创建app用户，请在终端手动执行如下指令:
// docker exec -it pv-postgres psql ${params}
// CREATE DATABASE app;
// CREATE USER app with encrypted password '${appdbpwd}';
// GRANT ALL PRIVILEGES ON DATABASE app TO postgres;
// \\q
// `)
//           }
//           resolve()
//         })
//       })
//     })
//   })
// }

async function deploy (fastify, cfg = {}) {
  const { soa, _, $, log, config, shell } = fastify
  const cfgutil = config.util
  const docker = await soa.get('docker')
  if (!docker) {
    return false
  }

  let container = await $.retry(_.bindKey(util, 'findContainer'), { maxAttempts: 5, delayMs: 1000 })(_, docker, tagName).catch(e => {
  })

  if (container) {
    const startResult = await $.retry(_.bindKey(container, 'start'), { maxAttempts: 5, delayMs: 1000 })().catch(e => {
      log.error('start postgres container error:%s', e)
      return false
    })
    if (startResult) {
      await $.delay(1000)
      return true
    }
  }

  const pgdir = cfgutil.path('config', 'active', 'postgres')
  // const kcdir = cfgutil.path('config', 'active', 'keycloak')
  // log.debug('images=%o', images)
  // console.log('postgres cfg=', cfg)
  const conncfg = cfg.connection || {}
  let appdbpwd = conncfg.password
  if (!appdbpwd) {
    appdbpwd = _.cryptoRandom({ length: 16 })
    await fs.writeFile(path.join(pgdir, 'app.passwd'), appdbpwd)
  }
  // const kcdbpwd = await fs.readFile(path.join(pgdir, 'kc.passwd'), 'utf8').catch(async e => {
  //   const newpwd = _.cryptoRandom({ length: 16 })
  //   await fs.writeFile(path.join(pgdir, 'kc.passwd'), newpwd)
  //   log.debug('为pg产生kc用密码:%s', newpwd)
  //   return newpwd
  // })
  // const kcpwd = await fs.readFile(path.join(kcdir, 'admin.passwd'), 'utf8').catch(async e => {
  //   const newpwd = _.cryptoRandom({ length: 16 })
  //   await fs.writeFile(path.join(kcdir, 'admin.passwd'), newpwd)
  //   log.debug('为kc产生admin用密码:%s', newpwd)
  //   return newpwd
  // })
  // const kcmpwd = await fs.readFile(path.join(kcdir, 'manage.passwd'), 'utf8').catch(async e => {
  //   const newpwd = _.cryptoRandom({ length: 16 })
  //   await fs.writeFile(path.join(kcdir, 'manage.passwd'), newpwd)
  //   log.debug('为kc产生manage用密码:%s', newpwd)
  //   return newpwd
  // })

  // await fs.writeFile(cfgutil.path('config', 'active', 'docker-compose.yml'), updcompose({
  //   kcdbpwd,
  //   kcpwd,
  //   kcmpwd
  // }))

  await fs.writeFile(cfgutil.path('config', 'active', 'docker-compose.yml'), updcompose({
    appdbpwd
  }))

  const pwd = shell.pwd()
  await shell.cd(cfgutil.path('config', 'active'))
  await shell.pexec('docker-compose up -d')
  shell.cd(pwd)

  await $.delay(1000)

  container = await $.retry(_.bindKey(util, 'findContainer'), { maxAttempts: 5, delayMs: 1000 })(_, docker, tagName).catch(e => {
    log.error('get postgres container error:%s', e)
  })

  if (!container) {
    return false
  }

  // await setUserpwd(fastify, container, appdbpwd, kcdbpwd)
  log.debug('founded conatiner=%o', container)
  return true
}

module.exports.deploy = deploy
