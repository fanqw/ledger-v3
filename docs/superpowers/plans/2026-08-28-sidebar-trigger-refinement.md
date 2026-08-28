# Sidebar Trigger Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将桌面侧栏展开收起按钮改成与分隔线融合的 24px 视觉小把手，同时保留 32px 可操作热区。

**Architecture:** 不改变 `SideNav.tsx` 的结构和状态逻辑，只通过按钮伪元素拆分“交互热区”和“可见圆钮”。静态契约固定尺寸、位置和弱阴影，Playwright 截图验证视觉融合及原有交互。

**Tech Stack:** CSS、Node test runner、Playwright CLI、React/Ant Design 现有布局

---

## File Structure

- Modify `apps/web/scripts/ui-layout-contract.test.mjs`: 固定视觉圆钮、热区、贴边位置和弱阴影契约。
- Modify `apps/web/src/index.css`: 实现透明热区与 24px 可见圆钮。
- Artifacts `output/playwright/pro-sidebar-trigger-refined.png`: 桌面目检截图，不纳入版本控制。

### Task 1: Refine the Embedded Trigger

**Files:**
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Write the failing style contract**

Replace the existing trigger position assertion and add explicit visual-size checks:

```js
assert.match(css, /\.sidebar-collapse-trigger\s*\{[^}]*right:\s*-16px[^}]*width:\s*32px[^}]*height:\s*32px/s);
assert.match(css, /\.sidebar-collapse-trigger::before\s*\{[^}]*width:\s*24px[^}]*height:\s*24px[^}]*border-radius:\s*50%/s);
assert.match(css, /box-shadow:\s*0 1px 4px rgba\(15, 23, 42, \.08\)/);
```

- [ ] **Step 2: Run the contract and verify it fails**

Run:

```bash
node --test apps/web/scripts/ui-layout-contract.test.mjs
```

Expected: FAIL because `.sidebar-collapse-trigger::before` is absent and the existing shadow is stronger.

- [ ] **Step 3: Implement the transparent hot area and visible handle**

Update the trigger rules to:

```css
.sidebar-collapse-trigger {
  position: absolute;
  top: 16px;
  right: -16px;
  z-index: 10;
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  color: var(--muted);
  background: transparent;
  border: 0;
  cursor: pointer;
}
.sidebar-collapse-trigger::before {
  position: absolute;
  width: 24px;
  height: 24px;
  content: '';
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(15, 23, 42, .08);
  transition: border-color .2s, box-shadow .2s;
}
.sidebar-collapse-trigger .anticon { position: relative; z-index: 1; font-size: 10px; }
.sidebar-collapse-trigger:hover::before { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); }
.sidebar-collapse-trigger:focus-visible { outline: 0; }
.sidebar-collapse-trigger:focus-visible::before { outline: 2px solid var(--accent); outline-offset: 2px; }
[data-theme='dark'] .sidebar-collapse-trigger::before { box-shadow: 0 1px 4px rgba(0, 0, 0, .24); }
```

- [ ] **Step 4: Run tests and build**

Run:

```bash
pnpm --filter web test
pnpm --filter web build
```

Expected: both commands exit 0.

- [ ] **Step 5: Verify in a real browser**

At 1440×900, verify the button remains named “收起导航”, its hit box is 32×32px, its visible circle is 24×24px, its center lies on the Sider boundary, and clicking still changes the Sider from 220px to 64px. Save `output/playwright/pro-sidebar-trigger-refined.png`.

- [ ] **Step 6: Run the final quality gate**

Run:

```bash
pnpm --filter web test
pnpm --filter web build
pnpm --filter web lint
openspec validate pro-style-sidebar --strict
git diff --check
```

Expected: tests/build/OpenSpec/diff checks pass; lint has zero errors and only the nine documented pre-existing warnings.

- [ ] **Step 7: Commit**

```bash
git add apps/web/scripts/ui-layout-contract.test.mjs apps/web/src/index.css
git commit -m "style(web): refine sidebar collapse handle"
```
