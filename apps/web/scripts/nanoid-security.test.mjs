import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const MINIMUM_SAFE_VERSION = [3, 3, 18]

function isOlderThan(version, minimum) {
  const parts = version.split('.').map(Number)

  for (const [index, part] of minimum.entries()) {
    if (parts[index] !== part) return parts[index] < part
  }

  return false
}

test('the lockfile contains no nanoid version vulnerable to CVE-2026-67213', async () => {
  const lockfile = await readFile(new URL('../../../pnpm-lock.yaml', import.meta.url), 'utf8')
  const versions = [...lockfile.matchAll(/^  nanoid@(\d+\.\d+\.\d+):$/gm)].map((match) => match[1])

  assert.ok(versions.length > 0, 'expected nanoid to be present in pnpm-lock.yaml')
  assert.deepEqual(
    versions.filter((version) => isOlderThan(version, MINIMUM_SAFE_VERSION)),
    [],
    `found nanoid versions older than ${MINIMUM_SAFE_VERSION.join('.')}`,
  )
})
