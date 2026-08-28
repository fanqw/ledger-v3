# Ant Design Pro Style Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有静态分组侧栏改造成参考图风格的层级导航，支持桌面默认展开、220/64px 持久化切换、边界圆形触发器和小屏完整抽屉。

**Architecture:** `menu.tsx` 继续作为唯一导航数据源，直接输出 Ant Design Menu 可识别的父子树；`SideNav.tsx` 拥有桌面折叠和 openKeys 状态，移动模式只渲染完整 Menu；`index.css` 负责边界触发器与主题表现。先修复最新 main 中已经失配的布局契约，再以 TDD 增加新行为。

**Tech Stack:** React 19、TypeScript、Ant Design 6、React Router、Node test runner、Playwright CLI、OpenSpec

---

## File Structure

- Modify `apps/web/scripts/ui-layout-contract.test.mjs`: 当前页面结构基线与新导航行为的静态契约。
- Modify `apps/web/src/components/layout/menu.tsx`: 唯一菜单树、父子关系和面包屑查找。
- Modify `apps/web/src/components/layout/SideNav.tsx`: Menu 状态、桌面折叠持久化、边界触发器和移动渲染。
- Modify `apps/web/src/components/layout/TopBar.tsx`: 移动菜单按钮无障碍名称。
- Modify `apps/web/src/index.css`: Pro 风格侧栏、选中态、触发器、主题和 reduced-motion。
- Modify `openspec/changes/pro-style-sidebar/tasks.md`: 完成项跟踪。

### Task 1: Restore the Web Layout Contract Baseline

**Files:**
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`
- Modify: `apps/web/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Replace stale page-primitive assertions with current observable structure**

Update the list-page loop so it reflects the post-`5aa00dce` layout instead of requiring removed `PageHeader` and `PageToolbar` components:

```js
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
```

- [ ] **Step 2: Run the contract test and confirm only the missing mobile label remains**

Run:

```bash
node --test apps/web/scripts/ui-layout-contract.test.mjs
```

Expected: one failure matching `打开导航`; the six stale page-structure failures are gone.

- [ ] **Step 3: Add the missing mobile navigation label**

In `TopBar.tsx`, change the mobile button to:

```tsx
<Button
  type="text"
  icon={<MenuOutlined />}
  aria-label="打开导航"
  onClick={onOpenNavigation}
  style={{ marginRight: 4 }}
/>
```

- [ ] **Step 4: Verify the baseline is green**

Run:

```bash
pnpm --filter web test
```

Expected: all security, effect-performance, and layout-contract tests pass.

- [ ] **Step 5: Commit the baseline repair**

```bash
git add apps/web/scripts/ui-layout-contract.test.mjs apps/web/src/components/layout/TopBar.tsx openspec/changes/pro-style-sidebar/tasks.md
git commit -m "test(web): restore layout contract baseline"
```

### Task 2: Define the Hierarchical Menu Contract

**Files:**
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`
- Modify: `apps/web/src/components/layout/menu.tsx`

- [ ] **Step 1: Add failing menu-tree assertions**

Add:

```js
test('navigation exposes direct items and expandable parent menus', () => {
  const menu = read('src/components/layout/menu.tsx');
  assert.match(menu, /key:\s*'\/dashboard'/);
  assert.match(menu, /key:\s*'\/analytics'/);
  assert.match(menu, /key:\s*'orders'[\s\S]*children:/);
  assert.match(menu, /key:\s*'materials'[\s\S]*children:/);
  assert.match(menu, /findParentMenuKey/);
});
```

- [ ] **Step 2: Run the test and verify it fails for the missing dashboard and parent helper**

Run:

```bash
node --test apps/web/scripts/ui-layout-contract.test.mjs
```

Expected: FAIL because `/dashboard` and `findParentMenuKey` are absent.

- [ ] **Step 3: Add dashboard and a parent lookup helper**

Update imports and menu data:

```tsx
import { DashboardOutlined, BarChartOutlined, ProfileOutlined, BankOutlined, TagsOutlined, AppstoreOutlined, ShoppingCartOutlined, EnvironmentOutlined } from '@ant-design/icons';

export const MENU_ITEMS: TopMenuItem[] = [
  { key: '/dashboard', label: '仪表台', icon: <DashboardOutlined /> },
  { key: '/analytics', label: '数据分析', icon: <BarChartOutlined /> },
  // existing orders and materials parents remain unchanged
];

export function findParentMenuKey(pathname: string): string | undefined {
  return MENU_ITEMS.find((item) => item.children?.some((child) => pathname.startsWith(child.key)))?.key;
}
```

- [ ] **Step 4: Run the contract test and verify it passes**

Run:

```bash
node --test apps/web/scripts/ui-layout-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the menu contract**

```bash
git add apps/web/scripts/ui-layout-contract.test.mjs apps/web/src/components/layout/menu.tsx openspec/changes/pro-style-sidebar/tasks.md
git commit -m "feat(web): define hierarchical workspace menu"
```

### Task 3: Implement Persistent Pro-Style Collapse Behavior

**Files:**
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`
- Modify: `apps/web/src/components/layout/SideNav.tsx`

- [ ] **Step 1: Add failing collapse and open-key contracts**

Add:

```js
test('desktop sidebar persists pro-style collapse state', () => {
  const side = read('src/components/layout/SideNav.tsx');
  assert.match(side, /width=\{220\}/);
  assert.match(side, /collapsedWidth=\{64\}/);
  assert.match(side, /ledger:sidebar-collapsed/);
  assert.match(side, /trigger=\{null\}/);
  assert.match(side, /sidebar-collapse-trigger/);
  assert.match(side, /aria-label=\{collapsed \? '展开导航' : '收起导航'\}/);
  assert.match(side, /openKeys=\{openKeys\}/);
  assert.match(side, /findParentMenuKey/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test apps/web/scripts/ui-layout-contract.test.mjs
```

Expected: FAIL on width, persistence, custom trigger, and openKeys.

- [ ] **Step 3: Replace the static group conversion with Menu children**

Map the source tree without converting parents to `type: 'group'`:

```tsx
const items: MenuProps['items'] = MENU_ITEMS.map((item) => ({
  key: item.key,
  label: item.label,
  icon: item.icon,
  children: item.children?.map((child) => ({
    key: child.key,
    label: child.label,
    icon: child.icon,
  })),
}));
```

- [ ] **Step 4: Implement collapse persistence and route-aware openKeys**

Use these state rules:

```tsx
const storageKey = 'ledger:sidebar-collapsed';
const [collapsed, setCollapsed] = useState(() => !mobile && localStorage.getItem(storageKey) === 'true');
const routeParent = findParentMenuKey(location.pathname);
const [openKeys, setOpenKeys] = useState<string[]>(() => routeParent ? [routeParent] : []);

useEffect(() => {
  const parent = findParentMenuKey(location.pathname);
  if (parent) setOpenKeys((keys) => keys.includes(parent) ? keys : [...keys, parent]);
}, [location.pathname]);

const toggleCollapsed = () => {
  const next = !collapsed;
  setCollapsed(next);
  localStorage.setItem(storageKey, String(next));
};
```

- [ ] **Step 5: Render mobile Menu separately and desktop Sider with a custom trigger**

Mobile branch:

```tsx
if (mobile) {
  return (
    <nav aria-label="主导航">
      <Menu mode="inline" selectedKeys={[location.pathname]} openKeys={openKeys}
        onOpenChange={setOpenKeys} items={items} onClick={onClick} />
    </nav>
  );
}
```

Desktop shell:

```tsx
<Sider width={220} collapsedWidth={64} collapsed={collapsed} trigger={null}
  className="app-sider" style={{ background: 'var(--surface)' }}>
  <nav aria-label="主导航">
    <Menu mode="inline" inlineCollapsed={collapsed} selectedKeys={[location.pathname]}
      openKeys={openKeys} onOpenChange={setOpenKeys} items={items} onClick={onClick} />
  </nav>
  <button type="button" className="sidebar-collapse-trigger"
    aria-label={collapsed ? '展开导航' : '收起导航'} onClick={toggleCollapsed}>
    {collapsed ? <RightOutlined /> : <LeftOutlined />}
  </button>
</Sider>
```

- [ ] **Step 6: Run the Web tests and verify they pass**

Run:

```bash
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 7: Commit the interaction implementation**

```bash
git add apps/web/scripts/ui-layout-contract.test.mjs apps/web/src/components/layout/SideNav.tsx openspec/changes/pro-style-sidebar/tasks.md
git commit -m "feat(web): add persistent sidebar collapse"
```

### Task 4: Match the Reference Styling

**Files:**
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add failing style contracts**

Add assertions for `.app-sider`, `.sidebar-collapse-trigger`, `right: -16px`, a circular radius, selected-item background, dark theme, and the existing reduced-motion block.

```js
test('sidebar trigger matches the reference boundary treatment', () => {
  const css = read('src/index.css');
  assert.match(css, /\.app-sider\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.sidebar-collapse-trigger\s*\{[^}]*right:\s*-16px[^}]*border-radius:\s*50%/s);
  assert.match(css, /\.sidebar-collapse-trigger:hover/);
  assert.match(css, /\[data-theme='dark'\] \.sidebar-collapse-trigger/);
});
```

- [ ] **Step 2: Run the contract and verify it fails**

Run:

```bash
node --test apps/web/scripts/ui-layout-contract.test.mjs
```

Expected: FAIL because the new classes have no styles.

- [ ] **Step 3: Add the Pro-style sider and trigger CSS**

Implement:

```css
.app-sider { position: relative; z-index: 2; border-right: 1px solid var(--line); }
.app-sider .ant-layout-sider-children { overflow: visible; }
.app-sider .ant-menu { padding: 8px; background: transparent; border-inline-end: 0 !important; }
.app-sider .ant-menu-item-selected { color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.sidebar-collapse-trigger {
  position: absolute; top: 16px; right: -16px; z-index: 10;
  display: grid; width: 32px; height: 32px; padding: 0; place-items: center;
  color: var(--muted); background: var(--surface); border: 1px solid var(--line);
  border-radius: 50%; box-shadow: 0 4px 12px rgba(15, 23, 42, .12); cursor: pointer;
  transition: color .2s, border-color .2s, box-shadow .2s;
}
.sidebar-collapse-trigger:hover { color: var(--accent); border-color: var(--accent); box-shadow: 0 6px 16px rgba(59, 130, 246, .2); }
[data-theme='dark'] .sidebar-collapse-trigger { box-shadow: 0 4px 12px rgba(0, 0, 0, .4); }
```

- [ ] **Step 4: Run tests and build**

Run:

```bash
pnpm --filter web test
pnpm --filter web build
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the visual treatment**

```bash
git add apps/web/scripts/ui-layout-contract.test.mjs apps/web/src/index.css openspec/changes/pro-style-sidebar/tasks.md
git commit -m "style(web): match pro sidebar reference"
```

### Task 5: Browser Verification and Final Quality Gate

**Files:**
- Modify: `openspec/changes/pro-style-sidebar/tasks.md`
- Artifacts: `output/playwright/pro-sidebar-*.png` (ignored verification output)

- [ ] **Step 1: Start the isolated Web and API services**

Run the project-standard local services on ports 5174 and 3001, preserving any existing user services. Confirm `/api/health` and `/login` respond before browser automation.

- [ ] **Step 2: Verify desktop expanded behavior at 1440×900**

Using Playwright CLI, log in, open `/orders`, and assert:

- Sider width is 220px.
- “订单管理” is expanded and “订单列表” is selected.
- Trigger name is “收起导航”.
- No page-level horizontal overflow.

Save `output/playwright/pro-sidebar-expanded.png`.

- [ ] **Step 3: Verify collapse and refresh persistence**

Click the trigger, assert Sider width is 64px and trigger name becomes “展开导航”; reload and assert the 64px state remains. Save `output/playwright/pro-sidebar-collapsed.png`.

- [ ] **Step 4: Verify route-aware parent expansion**

Expand “物料管理”, navigate to “商品信息”, and assert the parent remains expanded and the child is selected. Clear the stored collapsed state after the check.

- [ ] **Step 5: Verify tablet and phone drawer behavior**

At 768×1024 and 390×844, assert desktop Sider and collapse trigger are absent, “打开导航” is visible, and the Drawer shows full parent and child labels. Save tablet and phone screenshots.

- [ ] **Step 6: Run final verification**

Run:

```bash
pnpm --filter web test
pnpm --filter web build
pnpm --filter web lint
openspec validate pro-style-sidebar --strict
git diff --check
```

Expected: tests/build/OpenSpec/diff checks pass; lint has zero errors and only documented pre-existing warnings.

- [ ] **Step 7: Commit verification tracking**

```bash
git add openspec/changes/pro-style-sidebar/tasks.md
git commit -m "test(web): verify pro-style sidebar"
```
