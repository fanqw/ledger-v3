import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const MINIMUM_SAFE_VERSION = [7, 15, 0]

function isOlderThan(version, minimum) {
  const [coreVersion, prerelease] = version.split('-', 2)
  const parts = coreVersion.split('.').map(Number)
  for (let index = 0; index < minimum.length; index += 1) {
    if (parts[index] !== minimum[index]) return parts[index] < minimum[index]
  }
  return prerelease !== undefined
}

function extractLockedVersions(lockfile) {
  return [...lockfile.matchAll(/^  react-router(?:-dom)?@([^\s:(]+)(?:\([^\n]*\))?:$/gm)].map(
    (match) => match[1],
  )
}

test('prerelease React Router versions are compared against the stable boundary', () => {
  const versions = extractLockedVersions(`  react-router@7.15.0-pre.0:\n  react-router-dom@7.15.0:\n`)

  assert.deepEqual(versions, ['7.15.0-pre.0', '7.15.0'])
  assert.equal(isOlderThan(versions[0], MINIMUM_SAFE_VERSION), true)
  assert.equal(isOlderThan(versions[1], MINIMUM_SAFE_VERSION), false)
})

test('all React Router packages are safe from manifest path expansion DoS', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const lockfile = await readFile(new URL('../../../pnpm-lock.yaml', import.meta.url), 'utf8')
  const declaredVersion = packageJson.dependencies['react-router-dom'].replace(/^[^\d]*/, '')
  const lockedVersions = extractLockedVersions(lockfile)

  assert.equal(isOlderThan(declaredVersion, MINIMUM_SAFE_VERSION), false)
  assert.ok(lockedVersions.length > 0, 'expected React Router packages in pnpm-lock.yaml')
  assert.deepEqual(lockedVersions.filter((version) => isOlderThan(version, MINIMUM_SAFE_VERSION)), [])
})
