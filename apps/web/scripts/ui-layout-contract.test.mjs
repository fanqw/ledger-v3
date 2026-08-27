import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('theme and page primitives expose the unified workspace contract', () => {
  const main = read('src/main.tsx');
  const css = read('src/index.css');
  const header = read('src/components/page/PageHeader.tsx');
  const toolbar = read('src/components/page/PageToolbar.tsx');
  const state = read('src/components/page/DataState.tsx');

  assert.match(main, /colorPrimary:\s*'#3B82F6'/);
  assert.match(css, /--workspace-bg:/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(header, /page-header__actions/);
  assert.match(toolbar, /page-toolbar/);
  assert.match(state, /onRetry/);
});
