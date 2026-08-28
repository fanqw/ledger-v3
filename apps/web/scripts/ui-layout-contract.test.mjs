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
  assert.match(responsive, /mobile-empty/);
  assert.match(actions, /aria-label/);
  assert.match(actions, /modal\.confirm/);
});

test('application shell uses narrow sider and mobile drawer', () => {
  const shell = read('src/components/layout/AppShell.tsx');
  const side = read('src/components/layout/SideNav.tsx');
  const top = read('src/components/layout/TopBar.tsx');
  assert.match(shell, /mobileNavOpen/);
  assert.match(shell, /<Drawer/);
  assert.match(shell, /size=\{280\}/);
  assert.doesNotMatch(shell, /<Drawer[^>]*\bwidth=/s);
  assert.match(side, /collapsedWidth=\{64\}/);
  assert.match(top, /打开导航/);
});

test('navigation exposes direct items and expandable parent menus', () => {
  const menu = read('src/components/layout/menu.tsx');
  assert.match(menu, /key:\s*'\/analytics'/);
  assert.match(menu, /key:\s*'\/orders'/);
  assert.match(menu, /key:\s*'materials'[\s\S]*children:/);
  assert.match(menu, /key:\s*'purchasing'[\s\S]*children:/);
  assert.match(menu, /getMatchMenu/);
  assert.match(menu, /getNavMenuItems/);
});

test('desktop sidebar persists pro-style collapse state', () => {
  const side = read('src/components/layout/SideNav.tsx');
  assert.match(side, /width=\{220\}/);
  assert.match(side, /collapsedWidth=\{64\}/);
  assert.match(side, /ledger:sidebar-collapsed/);
  assert.match(side, /trigger=\{null\}/);
  assert.match(side, /sidebar-collapse-trigger/);
  assert.match(side, /aria-label=\{collapsed \? '展开导航' : '收起导航'\}/);
  assert.match(side, /collapsed && !mobile \? \{\} : \{ openKeys/);
  assert.match(side, /getMatchMenu/);
});

test('sidebar trigger matches the reference boundary treatment', () => {
  const side = read('src/components/layout/SideNav.tsx');
  const css = read('src/index.css');
  assert.match(css, /\.app-sider\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.app-sider \.ant-menu-item-selected\s*\{[^}]*background:/s);
  assert.match(css, /\.sidebar-collapse-trigger\s*\{[^}]*right:\s*-16px[^}]*width:\s*32px[^}]*height:\s*32px/s);
  assert.match(css, /\.sidebar-collapse-trigger::before\s*\{[^}]*width:\s*24px[^}]*height:\s*24px[^}]*border-radius:\s*50%/s);
  assert.match(css, /box-shadow:\s*0 1px 4px rgba\(15, 23, 42, \.08\)/);
  assert.match(css, /\.sidebar-collapse-trigger:hover/);
  assert.match(css, /\.sidebar-collapse-trigger:focus-visible/);
  assert.match(css, /\[data-theme='dark'\] \.sidebar-collapse-trigger/);
  assert.match(side, /sidebar-collapse-trigger--collapsed/);
  assert.match(css, /\.sidebar-collapse-trigger--collapsed::before\s*\{[^}]*width:\s*22px[^}]*height:\s*22px/s);
  assert.match(css, /\.sidebar-collapse-trigger--collapsed\s*\{[^}]*color:\s*#b8bec8/s);
  assert.match(css, /\.sidebar-collapse-trigger--collapsed:hover\s*\{[^}]*color:\s*var\(--accent\)/s);
});

test('tablet and phone breakpoints prioritize usable workspace width', () => {
  const shell = read('src/components/layout/AppShell.tsx');
  const css = read('src/index.css');

  assert.match(shell, /screens\.lg === false/);
  assert.match(css, /@media \(max-width: 991px\)/);
  assert.match(css, /\.responsive-data__desktop \.ant-table\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.responsive-data__desktop \.ant-pagination\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.page-toolbar \.ant-input-search\s*\{[^}]*width:\s*100%/s);
});

test('phone layout stacks page actions without forcing horizontal compression', () => {
  const css = read('src/index.css');
  assert.match(css, /@media \(max-width: 479px\)/);
  assert.match(css, /\.page-header\s*\{[^}]*align-items:\s*stretch[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.page-header__actions\s*>\s*\.ant-space\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(css, /\.page-header__actions[^}]*\.ant-btn[^}]*\{[^}]*width:\s*100%/s);
});

for (const page of ['Orders', 'Categories', 'Units', 'Commodities', 'PurchasePlaces']) {
  test(`${page} keeps the current responsive list structure`, () => {
    const source = read(`src/pages/${page}.tsx`);
    assert.match(source, /<Typography\.Title/);
    assert.match(source, /className="page"/);
    assert.match(source, /<ResponsiveDataView/);
    assert.doesNotMatch(source, /<FloatButton/);
    assert.match(source, /aria-label=/);
  });
}

test('complex pages keep visible titles and responsive detail behavior', () => {
  const detail = read('src/pages/OrderDetail.tsx');
  assert.match(detail, /title=\{order\.name\}/);
  assert.match(detail, /scroll=\{\{\s*x:\s*1040,/);
  assert.match(read('src/pages/Analytics.tsx'), /数据分析工作台/);
});

test('order detail exposes a two-level fully visible category summary', () => {
  const detail = read('src/pages/OrderDetail.tsx');
  const css = read('src/index.css');

  assert.match(detail, /order-summary/);
  assert.match(detail, /order-summary__categories/);
  assert.match(detail, /groups\.map/);
  assert.match(detail, /order-summary__overview/);
  assert.match(detail, /groups\.length[^\n]*个分类/);
  assert.match(detail, /displayItems\.length[^\n]*项明细/);
  assert.match(detail, /order-summary__total/);
  assert.doesNotMatch(css, /\.order-summary[^}]*overflow-x:\s*(auto|scroll)/s);
  assert.match(css, /\.order-summary__categories\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.order-summary__overview\s*\{[^}]*justify-content:\s*space-between/s);
  assert.match(css, /@media \(max-width: 479px\)[\s\S]*\.order-summary__overview\s*\{[^}]*flex-direction:\s*column/s);
});
