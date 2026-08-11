import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const MINIMUM_SAFE_VERSION = [7, 12, 0]

function isOlderThan(version, minimum) {
  const parts = version.split('.').map(Number)
  for (let index = 0; index < minimum.length; index += 1) {
    if (parts[index] !== minimum[index]) return parts[index] < minimum[index]
  }
  return false
}

test('all React Router packages reject javascript open redirects', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const lockfile = await readFile(new URL('../../../pnpm-lock.yaml', import.meta.url), 'utf8')
  const declaredVersion = packageJson.dependencies['react-router-dom'].replace(/^[^\d]*/, '')
  const lockedVersions = [...lockfile.matchAll(/^  react-router(?:-dom)?@(\d+\.\d+\.\d+):$/gm)].map(
    (match) => match[1],
  )

  assert.equal(isOlderThan(declaredVersion, MINIMUM_SAFE_VERSION), false)
  assert.ok(lockedVersions.length > 0, 'expected React Router packages in pnpm-lock.yaml')
  assert.deepEqual(lockedVersions.filter((version) => isOlderThan(version, MINIMUM_SAFE_VERSION)), [])
})
