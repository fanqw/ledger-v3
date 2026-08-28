# Collapsed Sidebar Trigger State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让侧栏已收起时的展开按钮匹配参考图的 22px 白色弱化圆钮，同时保持现有 32px 热区和展开态样式。

**Architecture:** `SideNav.tsx` 通过状态类名暴露收起态，CSS 使用组合选择器覆盖伪元素尺寸、边框、阴影和箭头颜色。静态契约固定状态差异，Playwright 在 64px 侧栏下测量并截图。

**Tech Stack:** React、CSS、Node test runner、Playwright CLI

---

## File Structure

- Modify `apps/web/src/components/layout/SideNav.tsx`: 为按钮增加可测试的收起态类名。
- Modify `apps/web/src/index.css`: 定义 22px 收起态圆钮及弱化视觉。
- Modify `apps/web/scripts/ui-layout-contract.test.mjs`: 固定收起态状态类与样式契约。
- Artifact `output/playwright/pro-sidebar-collapsed-reference.png`: 收起态目检截图，不纳入版本控制。

### Task 1: Add the Collapsed Trigger State

**Files:**
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`
- Modify: `apps/web/src/components/layout/SideNav.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Write the failing state and style contract**

Add these assertions to `sidebar trigger matches the reference boundary treatment`:

```js
assert.match(side, /sidebar-collapse-trigger--collapsed/);
assert.match(css, /\.sidebar-collapse-trigger--collapsed::before\s*\{[^}]*width:\s*22px[^}]*height:\s*22px/s);
assert.match(css, /\.sidebar-collapse-trigger--collapsed\s*\{[^}]*color:\s*#b8bec8/s);
assert.match(css, /\.sidebar-collapse-trigger--collapsed:hover\s*\{[^}]*color:\s*var\(--accent\)/s);
```

- [ ] **Step 2: Run the contract and verify it fails**

Run:

```bash
node --test apps/web/scripts/ui-layout-contract.test.mjs
```

Expected: FAIL because the collapsed modifier class and 22px override do not exist.

- [ ] **Step 3: Expose collapsed state on the button**

Change the button class in `SideNav.tsx`:

```tsx
className={`sidebar-collapse-trigger${collapsed ? ' sidebar-collapse-trigger--collapsed' : ''}`}
```

- [ ] **Step 4: Add the collapsed-only visual override**

Append after the base trigger rules:

```css
.sidebar-collapse-trigger--collapsed { color: #b8bec8; }
.sidebar-collapse-trigger--collapsed::before {
  width: 22px;
  height: 22px;
  border-color: color-mix(in srgb, var(--line) 55%, transparent);
  box-shadow: 0 1px 3px rgba(15, 23, 42, .05);
}
.sidebar-collapse-trigger--collapsed:hover { color: var(--accent); }
[data-theme='dark'] .sidebar-collapse-trigger--collapsed::before {
  box-shadow: 0 1px 3px rgba(0, 0, 0, .18);
}
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
pnpm --filter web test
pnpm --filter web build
```

Expected: both commands exit 0.

- [ ] **Step 6: Verify collapsed appearance and interaction in Playwright**

At 1440×900, click “收起导航” and verify:

- Sider width is 64px.
- Trigger remains a 32×32px hit box.
- `::before` is 22×22px with the weak shadow.
- The button is named “展开导航”.
- Clicking it restores the Sider to 220px.

Save `output/playwright/pro-sidebar-collapsed-reference.png` and compare it with the supplied Ant Design Pro reference.

- [ ] **Step 7: Run the final quality gate**

Run:

```bash
pnpm --filter web test
pnpm --filter web build
pnpm --filter web lint
openspec validate pro-style-sidebar --strict
git diff --check
```

Expected: tests/build/OpenSpec/diff checks pass; lint has zero errors and only the nine documented pre-existing warnings.

- [ ] **Step 8: Commit**

```bash
git add apps/web/scripts/ui-layout-contract.test.mjs apps/web/src/components/layout/SideNav.tsx apps/web/src/index.css
git commit -m "style(web): match collapsed sidebar trigger reference"
```
