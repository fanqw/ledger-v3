import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const TARGETS = [
  'src/pages/Categories.tsx',
  'src/pages/Units.tsx',
  'src/pages/Commodities.tsx',
  'src/pages/PurchasePlaces.tsx',
  'src/pages/Orders.tsx',
  'src/pages/Analytics.tsx',
]

test('initial data effects do not synchronously update React state', () => {
  const result = spawnSync(
    'pnpm',
    ['exec', 'eslint', '--max-warnings=0', ...TARGETS],
    { cwd: new URL('../', import.meta.url), encoding: 'utf8' },
  )

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
})

test('analytics schedules one cancellable load and stale requests cannot clear loading', () => {
  const source = readFileSync(new URL('../src/pages/Analytics.tsx', import.meta.url), 'utf8')

  assert.match(source, /const task = setTimeout\(\(\) => \{ void fetchData\(\); \}, 0\)/)
  assert.match(source, /clearTimeout\(task\)/)
  const invalidations = source.match(
    /const staleController = abortRef\.current;\s*abortRef\.current = null;\s*staleController\?\.abort\(\);/g,
  )
  assert.equal(invalidations?.length, 2, 'replacement and cleanup must invalidate stale controllers before aborting')
  assert.match(source, /if \(abortRef\.current === controller\) setLoading\(false\)/)
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
    // 防抖延迟：列表页用 keyword.trim()，订单页用 filters.name/description（多字段搜索）
    assert.match(source, /const delay = .*\? 300 : 0/, `${target} must debounce the search`)
    // 单一可取消 effect：setTimeout 调度 fetchData（服务端排序后签名含分页/排序参数，Orders 另含 filters）
    assert.match(source, /setTimeout\(\(\) => \{ void fetchData\([^}]*\); \}, delay\)/, `${target} must schedule one cancellable load`)
    assert.match(source, /return \(\) => clearTimeout\(task\)/, `${target} must cancel the scheduled request`)
  }
})
