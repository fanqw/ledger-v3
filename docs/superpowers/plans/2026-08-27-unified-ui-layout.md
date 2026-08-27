# Unified UI Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有台账系统改造成经典蓝、轻量专业、桌面优先且兼顾平板与手机的统一响应式工作区，同时保持全部业务逻辑与 API 不变。

**Architecture:** 由应用级 Ant Design token 和 `index.css` 提供视觉基础，由小型共享呈现组件统一页面标题、工具栏、异步状态、响应式数据视图与行操作；页面继续拥有请求、分页、表单和业务状态。应用壳复用单一导航配置，在桌面/平板使用 Sider，在手机使用 Drawer。

**Tech Stack:** React 19、TypeScript、Ant Design 6、React Router 7、ECharts 6、Node test runner、Playwright E2E、Tailwind CSS。

---

## File Map

- Create `apps/web/src/components/page/PageHeader.tsx`: 页面标题、说明与唯一主操作。
- Create `apps/web/src/components/page/PageToolbar.tsx`: 搜索、筛选和刷新容器。
- Create `apps/web/src/components/page/DataState.tsx`: 加载、空数据、错误与重试反馈。
- Create `apps/web/src/components/page/ResponsiveDataView.tsx`: 桌面/平板表格和手机摘要列表边界。
- Create `apps/web/src/components/page/RowActions.tsx`: 有可访问名称的查看、编辑、删除操作。
- Create `apps/web/src/components/layout/navigation.tsx`: 单一导航项和面包屑配置。
- Modify `apps/web/src/main.tsx`: 统一 Ant Design 主题 token。
- Modify `apps/web/src/index.css`: 应用画布、共享页面类、断点、焦点与 reduced-motion。
- Modify `apps/web/src/components/layout/{AppShell,SideNav,TopBar}.tsx`: 三断点应用壳和移动抽屉。
- Modify `apps/web/src/pages/{Orders,Categories,Units,Commodities,PurchasePlaces,OrderDetail,Analytics}.tsx`: 迁移到共享页面结构。
- Create `apps/web/scripts/ui-layout-contract.test.mjs`: 无浏览器的结构契约回归。
- Create `apps/web/e2e/scripts/ui-layout.spec.mjs`: 登录后多视口行为与截图验收。

### Task 1: Theme Foundation and Page Primitives

**Files:**
- Create: `apps/web/scripts/ui-layout-contract.test.mjs`
- Create: `apps/web/src/components/page/PageHeader.tsx`
- Create: `apps/web/src/components/page/PageToolbar.tsx`
- Create: `apps/web/src/components/page/DataState.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Write the failing source-contract test**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('theme and page primitives expose the unified workspace contract', () => {
  const main = read('src/main.tsx');
  const css = read('src/index.css');
  const header = read('src/components/page/PageHeader.tsx');
  assert.match(main, /colorPrimary:\s*'#3B82F6'/);
  assert.match(css, /--workspace-bg:/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(header, /page-header__actions/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test apps/web/scripts/ui-layout-contract.test.mjs`
Expected: FAIL because `PageHeader.tsx` and the workspace CSS variables do not exist.

- [ ] **Step 3: Implement minimal theme and primitives**

Create `PageHeader` with this public API and semantic structure:

```tsx
import type { ReactNode } from 'react';
import { Typography } from 'antd';

export function PageHeader({ title, description, actions }: {
  title: string; description?: string; actions?: ReactNode;
}) {
  return <header className="page-header">
    <div><Typography.Title level={2}>{title}</Typography.Title>
      {description && <Typography.Text type="secondary">{description}</Typography.Text>}
    </div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </header>;
}
```

Implement `PageToolbar` as a semantic `section` accepting `children`, and `DataState` accepting `loading`, `error`, `empty`, `onRetry`, and `children`. Add CSS variables `--workspace-bg`, `--surface`, `--line`, `--text`, `--muted`, `--accent`; add `.page`, `.page-header`, `.page-toolbar`, focus-visible rules, and a `prefers-reduced-motion: reduce` block. Keep `#3B82F6` as the only accent and reduce routine card shadows.

- [ ] **Step 4: Verify GREEN and build**

Run: `node --test apps/web/scripts/ui-layout-contract.test.mjs && pnpm --filter web build`
Expected: both commands PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/main.tsx apps/web/src/index.css apps/web/src/components/page apps/web/scripts/ui-layout-contract.test.mjs && git commit -m "feat(web): establish unified workspace theme"`

### Task 2: Responsive Data and Row Actions

**Files:**
- Create: `apps/web/src/components/page/ResponsiveDataView.tsx`
- Create: `apps/web/src/components/page/RowActions.tsx`
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`

- [ ] **Step 1: Add failing contracts for mobile summary and accessible actions**

```js
test('responsive data and row actions expose mobile and accessible behavior', () => {
  const responsive = read('src/components/page/ResponsiveDataView.tsx');
  const actions = read('src/components/page/RowActions.tsx');
  assert.match(responsive, /responsive-data__mobile/);
  assert.match(responsive, /renderMobileItem/);
  assert.match(actions, /aria-label/);
  assert.match(actions, /Modal\.confirm|modal\.confirm/);
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test apps/web/scripts/ui-layout-contract.test.mjs`
Expected: FAIL because both component files are absent.

- [ ] **Step 3: Implement the minimal public interfaces**

```tsx
export function ResponsiveDataView<T>({ items, desktop, renderMobileItem, rowKey }: {
  items: T[]; desktop: React.ReactNode;
  renderMobileItem: (item: T) => React.ReactNode;
  rowKey: (item: T) => React.Key;
}) {
  return <><div className="responsive-data__desktop">{desktop}</div>
    <div className="responsive-data__mobile" role="list">
      {items.map(item => <div role="listitem" key={rowKey(item)}>{renderMobileItem(item)}</div>)}
    </div></>;
}
```

Implement `RowActions` with labeled view/edit buttons and a labeled delete button that opens `modal.confirm` with record-specific text. Add CSS to show desktop view at `min-width:768px`, mobile view below it, and guarantee 40px action targets.

- [ ] **Step 4: Verify GREEN**

Run: `node --test apps/web/scripts/ui-layout-contract.test.mjs && pnpm --filter web build`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/components/page apps/web/src/index.css apps/web/scripts/ui-layout-contract.test.mjs && git commit -m "feat(web): add responsive data primitives"`

### Task 3: Responsive Application Shell

**Files:**
- Create: `apps/web/src/components/layout/navigation.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/components/layout/SideNav.tsx`
- Modify: `apps/web/src/components/layout/TopBar.tsx`
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`

- [ ] **Step 1: Add failing application-shell contracts**

```js
test('application shell uses narrow sider and mobile drawer', () => {
  const shell = read('src/components/layout/AppShell.tsx');
  const side = read('src/components/layout/SideNav.tsx');
  const top = read('src/components/layout/TopBar.tsx');
  assert.match(shell, /mobileNavOpen/);
  assert.match(shell, /<Drawer/);
  assert.match(side, /collapsedWidth=\{64\}/);
  assert.match(top, /打开导航/);
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test apps/web/scripts/ui-layout-contract.test.mjs`
Expected: FAIL because there is no Drawer state or mobile trigger.

- [ ] **Step 3: Implement the shell**

Move menu items and breadcrumb labels into `navigation.tsx`. Make `SideNav` controlled with `collapsed`, `onCollapsedChange`, and `mobile` props. `AppShell` owns `mobileNavOpen`, renders the desktop `Sider` plus an Ant Design `Drawer` using the same navigation component, and closes the drawer after route selection. `TopBar` accepts `onOpenNavigation` and renders `<Button aria-label="打开导航" className="mobile-nav-trigger">`.

- [ ] **Step 4: Verify GREEN and navigation build**

Run: `node --test apps/web/scripts/ui-layout-contract.test.mjs && pnpm --filter web build`
Expected: PASS; no duplicate route configuration errors.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/components/layout apps/web/src/index.css apps/web/scripts/ui-layout-contract.test.mjs && git commit -m "feat(web): make application shell responsive"`

### Task 4: Orders and Master Data Pages

**Files:**
- Modify: `apps/web/src/pages/Orders.tsx`
- Modify: `apps/web/src/pages/Categories.tsx`
- Modify: `apps/web/src/pages/Units.tsx`
- Modify: `apps/web/src/pages/Commodities.tsx`
- Modify: `apps/web/src/pages/PurchasePlaces.tsx`
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`

- [ ] **Step 1: Add failing list-page migration contracts**

```js
for (const page of ['Orders','Categories','Units','Commodities','PurchasePlaces']) {
  test(`${page} uses unified page structure`, () => {
    const source = read(`src/pages/${page}.tsx`);
    assert.match(source, /<PageHeader/);
    assert.match(source, /<PageToolbar/);
    assert.match(source, /<ResponsiveDataView/);
    assert.doesNotMatch(source, /<FloatButton/);
  });
}
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test apps/web/scripts/ui-layout-contract.test.mjs`
Expected: five failures because pages still use standalone headings/cards and Orders uses FloatButton.

- [ ] **Step 3: Migrate Orders first with unchanged data flow**

Wrap the existing table and form logic with `PageHeader`, `PageToolbar`, `DataState`, and `ResponsiveDataView`. Put `<Button type="primary" icon={<PlusOutlined />}>新增订单</Button>` in `PageHeader.actions`; render mobile rows with order name, purchase place, created date and a clear details affordance. Preserve `fetchData`, `loadPurchasePlaces`, `handleSave`, `confirmDelete`, pagination, debounce, and request bodies verbatim.

- [ ] **Step 4: Migrate four master-data pages**

Apply the same structure while preserving each page's existing columns, modal fields, Zod-compatible validation, search debounce, pagination and CRUD callbacks. Low-priority descriptions are omitted on tablet/mobile; record name and key relation remain visible.

- [ ] **Step 5: Verify GREEN and existing effect regression**

Run: `node --test apps/web/scripts/ui-layout-contract.test.mjs apps/web/scripts/effect-performance.test.mjs && pnpm --filter web build`
Expected: PASS; list effect tests remain green.

- [ ] **Step 6: Commit**

Run: `git add apps/web/src/pages apps/web/scripts/ui-layout-contract.test.mjs && git commit -m "feat(web): unify list page layouts"`

### Task 5: Order Detail and Analytics

**Files:**
- Modify: `apps/web/src/pages/OrderDetail.tsx`
- Modify: `apps/web/src/pages/Analytics.tsx`
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`

- [ ] **Step 1: Add failing complex-page contracts**

```js
test('complex pages use unified layout without replacing business engines', () => {
  const detail = read('src/pages/OrderDetail.tsx');
  const analytics = read('src/pages/Analytics.tsx');
  assert.match(detail, /<PageHeader/);
  assert.match(detail, /order-detail__table-scroll/);
  assert.match(analytics, /<PageHeader/);
  assert.match(analytics, /analytics-grid/);
  assert.match(analytics, /useECharts|use-echarts/);
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test apps/web/scripts/ui-layout-contract.test.mjs`
Expected: FAIL on new layout markers.

- [ ] **Step 3: Migrate OrderDetail presentation only**

Use `PageHeader` for order identity/export/create actions and place the existing Ant Design table inside `.order-detail__table-scroll`. Keep rowSpan, amount calculation, `isModified` highlighting, autocomplete creation, CRUD requests and Excel export unchanged. Set key identity and action columns sticky where Ant Design supports it.

- [ ] **Step 4: Migrate Analytics presentation only**

Use `PageHeader`, `PageToolbar`, and `DataState`; define `.analytics-grid` for KPI and chart regions. Preserve all request parameters, time presets, ECharts options and `useECharts` lifecycle. Ensure chart containers retain explicit responsive heights.

- [ ] **Step 5: Verify GREEN**

Run: `node --test apps/web/scripts/ui-layout-contract.test.mjs && pnpm --filter web build`
Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add apps/web/src/pages apps/web/src/index.css apps/web/scripts/ui-layout-contract.test.mjs && git commit -m "feat(web): unify detail and analytics layouts"`

### Task 6: Multi-Viewport E2E and Full Verification

**Files:**
- Create: `apps/web/e2e/scripts/ui-layout.spec.mjs`
- Modify: `apps/web/package.json`
- Modify: `openspec/changes/unified-ui-layout/tasks.md`

- [ ] **Step 1: Write the failing Playwright behavior test**

Create a script that logs in once for each viewport `[1440x960, 1024x768, 390x844]`, visits `/orders`, and asserts: desktop has visible Sider and complete table; tablet retains visible navigation without horizontal page overflow; phone has `button[aria-label="打开导航"]`, opens the Drawer, shows order summaries, and has no body-level horizontal overflow. Save screenshots under `apps/web/e2e/reports/unified-ui-layout/`.

- [ ] **Step 2: Run E2E and verify RED where behavior is incomplete**

Run: `pnpm --filter web ui-layout:e2e`
Expected: FAIL on any remaining selector, overflow, or responsive visibility mismatch; infrastructure errors are fixed before treating the test as RED.

- [ ] **Step 3: Make only the CSS/markup corrections required by the failing assertions**

Adjust breakpoint visibility, min-width, sticky columns, action labels, Drawer close behavior, or chart resize handling. Do not alter API payloads or business calculations.

- [ ] **Step 4: Run all verification commands**

Run: `pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build`
Expected: all PASS.

Run with the local stack active: `pnpm --filter web smoke:e2e && pnpm --filter web verify:e2e && pnpm --filter web ui-layout:e2e`
Expected: all PASS; screenshots exist for the three viewports and show no overlap or clipped primary action.

- [ ] **Step 5: Update OpenSpec checklist and commit**

Mark completed items in `openspec/changes/unified-ui-layout/tasks.md`, then run `openspec validate unified-ui-layout --strict`.

Run: `git add apps/web openspec/changes/unified-ui-layout/tasks.md docs/superpowers/plans/2026-08-27-unified-ui-layout.md && git commit -m "test(web): verify unified responsive workspace"`

