import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const MINIMUM_SAFE_VERSION = [7, 14, 2]

function isOlderThan(version, minimum) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
  assert.ok(match, `expected a valid semver, received ${version}`)
  const parts = match.slice(1, 4).map(Number)
  for (let index = 0; index < minimum.length; index += 1) {
    if (parts[index] !== minimum[index]) return parts[index] < minimum[index]
  }
  return match[4] !== undefined
}

test('treats prerelease versions below the stable minimum as unsafe', () => {
  assert.equal(isOlderThan('7.14.1-pre.0', MINIMUM_SAFE_VERSION), true)
  assert.equal(isOlderThan('7.14.2-pre.0', MINIMUM_SAFE_VERSION), true)
})

test('all React Router packages use safe turbo-stream deserialization', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const lockfile = await readFile(new URL('../../../pnpm-lock.yaml', import.meta.url), 'utf8')
  const declaredVersion = packageJson.dependencies['react-router-dom'].replace(/^[^\d]*/, '')
  const lockedVersions = [
    ...lockfile.matchAll(
      /^  react-router(?:-dom)?@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?):$/gm,
    ),
  ].map((match) => match[1])

  assert.equal(isOlderThan(declaredVersion, MINIMUM_SAFE_VERSION), false)
  assert.ok(lockedVersions.length > 0, 'expected React Router packages in pnpm-lock.yaml')
  assert.deepEqual(lockedVersions.filter((version) => isOlderThan(version, MINIMUM_SAFE_VERSION)), [])
})
