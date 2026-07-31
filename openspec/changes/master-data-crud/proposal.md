# Proposal: master-data-crud

## Summary

实现基础资料（分类、单位、商品、进货地）四个模块的完整 CRUD 管理，包括分页搜索、名称唯一约束、软删除关联保护，以及关键的前端即输即建（type-to-create）下拉组件。

## Motivation

P0-P2 已完成项目骨架、认证鉴权、布局壳，但系统尚无业务数据入口。P3 是核心业务数据的第一块拼图——所有订单和统计都依赖基础资料。即输即建组件作为跨模块基础设施，必须在 P3 提前交付，供 P4 订单管理直接复用。

## Scope

### In Scope
- Category 分类管理（列表 + 新增/编辑弹窗 + 软删除 + 关联保护）
- Unit 单位管理（同上，行为对称）
- Commodity 商品管理（列表 + 新增/编辑弹窗 + 分类/单位下拉 + 软删除 + 关联保护）
- PurchasePlace 进货地管理（列表 + 新增/编辑弹窗 + 软删除 + 关联保护）
- 统一 DataTable 组件（分页 + 关键字搜索 + 默认 updatedAt DESC）
- **即输即建下拉组件**（`CreatableSelect`）：输入文本无匹配时，将用户输入动态文本持久化到数据库并返回新记录 ID — 跨模块基础设施，P4+ 所有主数据关联场景复用
- shadcn/ui 组件补齐（Dialog、AlertDialog、Command、Table、Select、Sonner）
- 后端与前端共用 `packages/shared` 已有 Zod Schema（`paginationSchema`、`categorySchema`、`unitSchema`、`commoditySchema`、`purchasePlaceSchema`）和错误码常量（`ERROR_CODES`、`ERROR_MESSAGES`）
- 统一响应格式（`{ success: true, data }` / `{ success: false, error: { code, message } }`），与 P1 auth 模块保持一致
- Swagger API 文档装饰器
- Vitest 单元测试 + NestJS E2E 测试

### Out of Scope
- 订单创建页面的进货地下拉（P4）—— 此场景只需下拉选，不需要即输即建（因为进货地有两个字段 place + marketName）
- 批量导入/导出
- 权限细分（当前所有登录用户均可访问）

## Impact

| 层 | 变更 |
|----|------|
| Backend | 新增 `apps/server/src/modules/category/` |
| Backend | 新增 `apps/server/src/modules/unit/` |
| Backend | 新增 `apps/server/src/modules/commodity/` |
| Backend | 新增 `apps/server/src/modules/purchase-place/` |
| Backend | 新增 `apps/server/src/common/` — ZodValidationPipe + Prisma 异常处理 helper |
| Backend | 修改 `app.module.ts`（引入 4 个模块） |
| Frontend | 新增 shadcn/ui 组件：dialog, alert-dialog, command, table, select（+ 安装 sonner） |
| Frontend | 新增 `apps/web/src/components/ui/data-table.tsx`（通用表格） |
| Frontend | 新增 `apps/web/src/components/ui/creatable-select.tsx`（即输即建下拉） |
| Frontend | 新增 `apps/web/src/pages/Categories.tsx` |
| Frontend | 新增 `apps/web/src/pages/Units.tsx` |
| Frontend | 新增 `apps/web/src/pages/Commodities.tsx` |
| Frontend | 新增 `apps/web/src/pages/PurchasePlaces.tsx` |
| Frontend | 修改 `App.tsx`（添加 4 个路由） |
| Shared | 无需变更（已有 Schema + 错误码直接复用） |

## Risks

- **即输即建并发**：两个用户同时输入同一新名称 → 第二个唯一约束冲突。解法：后端捕获 Prisma P2002 + 返回 409 + existingId，前端 CreatableSelect 静默选中已有记录
- **删除关联检查 TOCTOU 竞态**：检查时无关联 → 删除前另一请求创建关联 → 数据不一致。解法：检查 + set deletedAt 放在 Prisma 事务中
- **前端下拉的防抖**：即输即建场景用户快速输入 → 需 debounce 搜索请求，避免抖动创建
- **响应格式一致性**：必须与 P1 auth 模块对齐（`{ success: true, data }`），否则前端 `data.success` 判断均失效
