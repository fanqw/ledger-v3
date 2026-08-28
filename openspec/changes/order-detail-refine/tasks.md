# Tasks: order-detail-refine

## Phase 1：前端实现

- [x] `AppShell.tsx`：面包屑行 flex 化 + `breadcrumbExtra` 插槽 + `Outlet context` 传递 setter
- [x] `OrderDetail.tsx`：`useOutletContext` 注册返回按钮（纯文本，无图标），卸载清理
- [x] `OrderDetail.tsx`：Descriptions 备注独立 Descriptions（column=1）独占整行、进货金额 `¥` 前缀
- [x] `OrderDetail.tsx`：明细表格容器 ref + ResizeObserver 动态 `scroll.y`，底部 12px 下边距
- [x] `OrderDetail.tsx`：明细头部移除「共 x 项」，标题与操作按钮同行（space-between）
- [x] `OrderDetail.tsx` + `index.css`：总结栏**两层结构** `.order-summary`（上层分类区 + 下层总计区），与明细表格连续边界，移动端堆叠
- [x] `index.css`：清理旧的 `.summary-bar` / `.summary-seg` / `.summary-chip` 样式
- [x] `ui-layout-contract.test.mjs`：新增 order-summary 契约测试（两层结构/全量分类/总计文案/响应式）

## Phase 2：验证

- [x] `pnpm --filter web build` / `pnpm lint`（0 errors）
- [x] Playwright：返回按钮位置/跳转、备注独占一行、¥ 前缀、滚动到底、总结栏两层结构、暗色主题（40/40 通过）
- [x] 契约测试：新增 order-summary 用例通过（其余失败为既有问题：菜单重构遗留 + PR #188 列表页 aria-label）
