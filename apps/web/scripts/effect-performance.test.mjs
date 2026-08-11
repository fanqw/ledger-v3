import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const TARGETS = [
  'src/components/ui/creatable-select.tsx',
  'src/pages/Categories.tsx',
  'src/pages/Units.tsx',
  'src/pages/Commodities.tsx',
  'src/pages/PurchasePlaces.tsx',
]

test('initial data effects do not synchronously update React state', () => {
  const result = spawnSync(
    'pnpm',
    ['exec', 'eslint', '--max-warnings=0', ...TARGETS],
    { cwd: new URL('../', import.meta.url), encoding: 'utf8' },
  )

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
})
