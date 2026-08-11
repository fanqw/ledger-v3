import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('the lockfile contains no tmp version vulnerable to GHSA-7c78-jf6q-g5cm', async () => {
  const lockfile = await readFile(new URL('../../../pnpm-lock.yaml', import.meta.url), 'utf8')
  const versions = [...lockfile.matchAll(/^  tmp@(\d+)\.(\d+)\.(\d+):$/gm)]
    .map((match) => match.slice(1).map(Number))
  const vulnerable = versions.filter(([major, minor, patch]) => major === 0 && minor === 2 && patch < 7)

  assert.ok(versions.length > 0, 'expected tmp to be present in pnpm-lock.yaml')
  assert.deepEqual(vulnerable, [], 'found vulnerable tmp versions')
})
