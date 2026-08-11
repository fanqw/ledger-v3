import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const MINIMUM_SAFE_BY_MAJOR = new Map([
  [3, [3, 15, 1]],
  [4, [4, 3, 1]],
])

function isOlderThan(version, minimum) {
  const parts = version.split('.').map(Number)

  for (const [index, part] of minimum.entries()) {
    if (parts[index] !== part) return parts[index] < part
  }

  return false
}

test('the lockfile contains no js-yaml version vulnerable to GHSA-5p4m-2wfm-xmqj', async () => {
  const lockfile = await readFile(new URL('../../../pnpm-lock.yaml', import.meta.url), 'utf8')
  const versions = [...lockfile.matchAll(/^  js-yaml@(\d+\.\d+\.\d+):$/gm)].map((match) => match[1])
  const vulnerable = versions.filter((version) => {
    const minimum = MINIMUM_SAFE_BY_MAJOR.get(Number(version.split('.')[0]))
    return minimum ? isOlderThan(version, minimum) : false
  })

  assert.ok(versions.length > 0, 'expected js-yaml to be present in pnpm-lock.yaml')
  assert.deepEqual(vulnerable, [], 'found vulnerable js-yaml versions')
})

test('the default server test command runs the security regression test', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  )

  assert.match(packageJson.scripts.test, /(?:pnpm run )?test:security/)
  assert.match(packageJson.scripts['test:security'], /js-yaml-security\.test\.mjs|\*-security\.test\.mjs/)
  assert.match(packageJson.scripts['test:security'], /fast-uri-security\.test\.mjs|\*-security\.test\.mjs/)
})
