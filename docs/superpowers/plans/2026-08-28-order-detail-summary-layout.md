# Order Detail Summary Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the order detail page's single-row category strip with the approved two-level, fully visible summary band that joins directly to the detail table.

**Architecture:** Keep `groupItems` and `grandTotal` as the single source of summary data. Render a stateless two-level summary structure in `OrderDetail.tsx`, style it with page-specific classes in `index.css`, and extend the existing source-contract test to lock down structure and responsive behavior without changing order operations or APIs.

**Tech Stack:** React 19, TypeScript, Ant Design 6, CSS media queries, Node.js built-in test runner.

---

## File Structure

- Modify `apps/web/src/pages/OrderDetail.tsx`: render category summary items, overall scale text, and total amount as a two-level band; connect the band to the table wrapper.
- Modify `apps/web/src/index.css`: define desktop, tablet, phone, and dark-theme presentation for the summary band and its shared table boundary.
- Modify `apps/web/scripts/ui-layout-contract.test.mjs`: verify the semantic class contract, complete category rendering, aggregate copy, and responsive rules.

### Task 1: Lock the approved layout into a failing contract test

**Files:**
- Modify: `apps/web/scripts/ui-layout-contract.test.mjs`

- [ ] **Step 1: Write the failing test**

Add this test after the existing complex-page contract:

```js
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
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
node --test apps/web/scripts/ui-layout-contract.test.mjs
```

Expected: FAIL in `order detail exposes a two-level fully visible category summary` because `order-summary` does not yet exist.

- [ ] **Step 3: Commit the red test**

```bash
git add apps/web/scripts/ui-layout-contract.test.mjs
git commit -m "test(web): define order summary layout contract"
```

### Task 2: Implement the two-level summary structure

**Files:**
- Modify: `apps/web/src/pages/OrderDetail.tsx:396-425`

- [ ] **Step 1: Replace the current summary bar markup**

Replace the `summary-bar` block and wrap the table region with the following structure:

```tsx
{groups.length > 0 && (
  <section className="order-summary" aria-label="明细分类汇总">
    <div className="order-summary__categories">
      {groups.map((group) => (
        <div className="order-summary__category" key={group.categoryId}>
          <span className="order-summary__name">{group.categoryName}</span>
          <span className="order-summary__count">
            {new Set(group.items.map((item) => item.commodityId)).size} 种
          </span>
          <span className="order-summary__amount">¥{fmt(group.subtotal)}</span>
        </div>
      ))}
    </div>
    <div className="order-summary__overview">
      <span className="order-summary__scale">
        共 {groups.length} 个分类 · {displayItems.length} 项明细
      </span>
      <strong className="order-summary__total">总计 ¥{fmt(grandTotal)}</strong>
    </div>
  </section>
)}
```

Add `className="order-detail-table-wrap"` to the existing `tableWrapRef` wrapper. Keep `groups.length > 0` as the empty-state guard and retain all existing table props and operations.

- [ ] **Step 2: Run the focused test and observe the remaining CSS failures**

Run:

```bash
node --test apps/web/scripts/ui-layout-contract.test.mjs
```

Expected: the new structure assertions pass; CSS assertions still fail because the new selectors are not defined.

### Task 3: Implement visual hierarchy and responsive behavior

**Files:**
- Modify: `apps/web/src/index.css:73-98`

- [ ] **Step 1: Replace the current `.summary-*` rules**

Use the following page-scoped rules:

```css
.order-summary {
  flex: 0 0 auto;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
}
.order-summary__categories {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  padding: 4px 8px;
}
.order-summary__category {
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 9px 12px;
  border-right: 1px solid var(--line);
}
.order-summary__category:last-child { border-right: 0; }
.order-summary__name { color: var(--text); font-weight: 600; }
.order-summary__count { color: var(--muted); font-size: 12px; }
.order-summary__amount { color: var(--accent); font-weight: 650; font-variant-numeric: tabular-nums; }
.order-summary__overview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 44px;
  padding: 10px 20px;
  color: var(--muted);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  border-top: 1px solid var(--line);
}
.order-summary__scale { font-size: 13px; }
.order-summary__total { color: var(--accent); font-size: 16px; font-variant-numeric: tabular-nums; }
.order-detail-table-wrap .ant-table-container { border-radius: 0 0 8px 8px; }
[data-theme='dark'] .order-summary__overview {
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
}
```

- [ ] **Step 2: Add phone rules to the existing 479px media query**

```css
.order-summary__categories { padding: 4px; }
.order-summary__category { flex: 1 1 100%; border-right: 0; border-bottom: 1px solid var(--line); }
.order-summary__category:last-child { border-bottom: 0; }
.order-summary__overview { align-items: flex-start; flex-direction: column; gap: 4px; padding: 10px 16px; }
.order-summary__total { font-size: 17px; }
```

- [ ] **Step 3: Run the focused contract test**

Run:

```bash
node --test apps/web/scripts/ui-layout-contract.test.mjs
```

Expected: PASS with no failing subtests.

- [ ] **Step 4: Commit the implementation**

```bash
git add apps/web/src/pages/OrderDetail.tsx apps/web/src/index.css
git commit -m "style(web): redesign order category summary"
```

### Task 4: Verify behavior and viewport presentation

**Files:**
- Verify: `apps/web/src/pages/OrderDetail.tsx`
- Verify: `apps/web/src/index.css`
- Verify: `apps/web/scripts/ui-layout-contract.test.mjs`

- [ ] **Step 1: Run the complete Web test suite**

Run:

```bash
pnpm --filter web test
```

Expected: all security, effect-performance, and UI layout contract tests pass.

- [ ] **Step 2: Run build and lint**

Run:

```bash
pnpm --filter web build
pnpm --filter web lint
```

Expected: build succeeds; lint reports no new errors.

- [ ] **Step 3: Check patch hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended files or pre-existing user changes appear.

- [ ] **Step 4: Verify in a real browser**

Open an order detail page at 1440×900, 768×1024, and 390×844. Confirm that every category is visible, category items wrap without horizontal scrolling, the overview stacks on the phone, the total remains visually dominant, and the summary/table boundary is continuous.

- [ ] **Step 5: Commit test updates after green verification**

```bash
git add apps/web/scripts/ui-layout-contract.test.mjs docs/superpowers/plans/2026-08-28-order-detail-summary-layout.md
git commit -m "docs: plan order summary layout"
```
