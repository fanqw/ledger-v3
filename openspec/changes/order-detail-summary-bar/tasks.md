# Tasks: order-detail-summary-bar

## Phase 1：前端实现

- [ ] `index.css` 新增 `.order-detail-table` 列分隔线与分组边界 CSS、`.summary-bar` / `.summary-chip` / `.summary-total` 样式（含暗黑主题）
- [ ] `OrderDetail.tsx`：明细标题独立成行，操作按钮移至下一行右对齐
- [ ] `OrderDetail.tsx`：明细表格 `className="order-detail-table"` + `onRow` 标记分组首行 `group-start`
- [ ] `OrderDetail.tsx`：表格上方渲染分类总结栏（分类名·商品种数·分类金额 chips + 共计块），空明细时隐藏

## Phase 2：验证

- [ ] `pnpm --filter web build` / `pnpm lint`
- [ ] 浏览器验证：标题分行、列竖线、分组粗线、总结栏样式、暗黑主题
