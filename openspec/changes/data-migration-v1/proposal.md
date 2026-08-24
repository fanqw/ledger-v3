## Why

P0-P7 项目功能已全部落地，但 V1 系统的存量数据（users、categories、units、commodities、orders、ordercommodities）尚未迁移到 V3 PostgreSQL。P6 数据迁移是执行计划最后阶段，实现 V1 MongoDB → V3 PostgreSQL 的数据迁移，让历史订单可继承到新系统。

## What Changes

- **新增迁移脚本** `apps/server/prisma/migrate-from-v1.ts`（package.json 已挂 `db:migrate-from-v1` 命令，文件待实现）：
  - **导出**：从 V1 MongoDB（`V1_MONGO_URL`）读取 6 张集合（users/categories/units/commodities/orders/ordercommodities），只读不修改
  - **转换**：ObjectId → 24 位 hex String；字段名映射（desc→description、count→quantity、price→unitPrice、create_at/update_at→createdAt/updatedAt）；软删除（deleted 布尔 → deletedAt）；User role 默认 admin；ordercommodities → OrderItem
  - **导入**：按 User → Category → Unit → Commodity → Order → OrderItem 依赖顺序，维护 ObjectId 映射表，upsert 幂等
  - **验证**：记录数、SUM(lineTotal)、外键完整性、密码可登录
  - **回滚**：只写 V3，`prisma migrate reset` 可重置
- **配套**：安装 `mongodb` driver 依赖（后端）

## Capabilities

### New Capabilities

<!-- 无新 capability -->

### Modified Capabilities

- `data-migration`: 本 change 落地该 capability——导出→转换→导入三步、ObjectId 映射、幂等 upsert、验证清单、回滚方案

## Impact

- **后端**：新增 `apps/server/prisma/migrate-from-v1.ts`、`apps/server/prisma/migrate-from-v1.spec.ts`
- **依赖**：`mongodb`（新增，仅迁移用）
- **脚本**：`pnpm --filter server db:migrate-from-v1`（已有，指向待实现文件）
- **数据**：只写 V3，不碰 V1 MongoDB
