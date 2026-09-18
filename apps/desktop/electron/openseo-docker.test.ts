import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  composeFileFromLabels,
  decideContainerEnsure,
  dockerRunArgv,
  OPENSEO_CONTAINER,
  OPENSEO_HOST_PORT,
  OPENSEO_IMAGE
} from './openseo-docker'

test('dockerRunArgv mirrors the compose project: name, restart policy, localhost port', () => {
  assert.deepEqual(dockerRunArgv(), [
    'run',
    '-d',
    '--name',
    OPENSEO_CONTAINER,
    '--restart',
    'unless-stopped',
    '-p',
    `127.0.0.1:${OPENSEO_HOST_PORT}:3001`,
    OPENSEO_IMAGE
  ])
})

test('composeFileFromLabels reads the compose project config label', () => {
  assert.equal(
    composeFileFromLabels({ 'com.docker.compose.project.config_files': '/home/u/open-seo/compose.yaml' }),
    '/home/u/open-seo/compose.yaml'
  )
})

test('composeFileFromLabels tolerates missing or malformed labels', () => {
  assert.equal(composeFileFromLabels(null), null)
  assert.equal(composeFileFromLabels(undefined), null)
  assert.equal(composeFileFromLabels('nope'), null)
  assert.equal(composeFileFromLabels({}), null)
  assert.equal(composeFileFromLabels({ 'com.docker.compose.project.config_files': '' }), null)
  assert.equal(composeFileFromLabels({ 'com.docker.compose.project.config_files': 42 }), null)
})

test('a running container is a no-op regardless of compose availability', () => {
  assert.deepEqual(decideContainerEnsure({ containerExists: true, containerRunning: true, composeFile: '/x/compose.yaml' }), {
    kind: 'none'
  })
  assert.deepEqual(decideContainerEnsure({ containerExists: true, containerRunning: true, composeFile: null }), {
    kind: 'none'
  })
})

test('compose is the preferred rung whenever a compose file is on disk', () => {
  assert.deepEqual(decideContainerEnsure({ containerExists: true, containerRunning: false, composeFile: '/x/compose.yaml' }), {
    kind: 'compose-up',
    composeFile: '/x/compose.yaml'
  })
  assert.deepEqual(decideContainerEnsure({ containerExists: false, containerRunning: false, composeFile: '/x/compose.yaml' }), {
    kind: 'compose-up',
    composeFile: '/x/compose.yaml'
  })
})

test('a stopped container without compose falls to docker start', () => {
  assert.deepEqual(decideContainerEnsure({ containerExists: true, containerRunning: false, composeFile: null }), {
    kind: 'start'
  })
})

test('a missing container without compose falls to docker run', () => {
  assert.deepEqual(decideContainerEnsure({ containerExists: false, containerRunning: false, composeFile: null }), {
    kind: 'run'
  })
})
