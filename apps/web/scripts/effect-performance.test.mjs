import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const TARGETS = [
  'src/components/ui/creatable-select.tsx',
  'src/pages/Categories.tsx',
  'src/pages/Units.tsx',
  'src/pages/Commodities.tsx',
  'src/pages/PurchasePlaces.tsx',
  'src/pages/Orders.tsx',
]

test('initial data effects do not synchronously update React state', () => {
  const result = spawnSync(
    'pnpm',
    ['exec', 'eslint', '--max-warnings=0', ...TARGETS],
    { cwd: new URL('../', import.meta.url), encoding: 'utf8' },
  )

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
})

const LIST_PAGES = [
  'src/pages/Categories.tsx',
  'src/pages/Units.tsx',
  'src/pages/Commodities.tsx',
  'src/pages/PurchasePlaces.tsx',
  'src/pages/Orders.tsx',
]

test('list pages use one cancellable effect for initial load and debounced search', () => {
  for (const target of LIST_PAGES) {
    const source = readFileSync(new URL(`../${target}`, import.meta.url), 'utf8')

    assert.doesNotMatch(source, /mountedRef/, `${target} must not use a StrictMode-fragile mount guard`)
    assert.match(source, /const delay = keyword\.trim\(\) \? 300 : 0/)
    assert.match(source, /setTimeout\(\(\) => \{ void fetchData\(1, keyword\); \}, delay\)/)
    assert.match(source, /return \(\) => clearTimeout\(task\)/, `${target} must cancel the scheduled request`)
  }
})
