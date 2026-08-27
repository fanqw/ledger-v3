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

test('responsive data and row actions expose mobile and accessible behavior', () => {
  const responsive = read('src/components/page/ResponsiveDataView.tsx');
  const actions = read('src/components/page/RowActions.tsx');
  assert.match(responsive, /responsive-data__mobile/);
  assert.match(responsive, /renderMobileItem/);
  assert.match(actions, /aria-label/);
  assert.match(actions, /modal\.confirm/);
});

test('application shell uses narrow sider and mobile drawer', () => {
  const shell = read('src/components/layout/AppShell.tsx');
  const side = read('src/components/layout/SideNav.tsx');
  const top = read('src/components/layout/TopBar.tsx');
  assert.match(shell, /mobileNavOpen/);
  assert.match(shell, /<Drawer/);
  assert.match(side, /collapsedWidth=\{64\}/);
  assert.match(top, /打开导航/);
});

for (const page of ['Orders', 'Categories', 'Units', 'Commodities', 'PurchasePlaces']) {
  test(`${page} uses the unified page structure`, () => {
    const source = read(`src/pages/${page}.tsx`);
    assert.match(source, /<PageHeader/);
    assert.match(source, /<PageToolbar/);
    assert.doesNotMatch(source, /<FloatButton/);
  });
}

test('complex pages use the unified page header', () => {
  assert.match(read('src/pages/OrderDetail.tsx'), /<PageHeader/);
  assert.match(read('src/pages/Analytics.tsx'), /<PageHeader/);
});
