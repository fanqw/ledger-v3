import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const isVulnerableTmpVersion = ([major, minor, patch]) =>
  major === 0 && (minor < 2 || (minor === 2 && patch < 7))

test('tmp versions older than 0.2.7 are classified as vulnerable', () => {
  assert.equal(isVulnerableTmpVersion([0, 0, 0]), true)
  assert.equal(isVulnerableTmpVersion([0, 1, 14]), true)
  assert.equal(isVulnerableTmpVersion([0, 2, 6]), true)
  assert.equal(isVulnerableTmpVersion([0, 2, 7]), false)
  assert.equal(isVulnerableTmpVersion([1, 0, 0]), false)
})

test('the lockfile contains no tmp version vulnerable to GHSA-7c78-jf6q-g5cm', async () => {
  const lockfile = await readFile(new URL('../../../pnpm-lock.yaml', import.meta.url), 'utf8')
  const versions = [...lockfile.matchAll(/^  tmp@(\d+)\.(\d+)\.(\d+):$/gm)]
    .map((match) => match.slice(1).map(Number))
  const vulnerable = versions.filter(isVulnerableTmpVersion)

  assert.ok(versions.length > 0, 'expected tmp to be present in pnpm-lock.yaml')
  assert.deepEqual(vulnerable, [], 'found vulnerable tmp versions')
})
