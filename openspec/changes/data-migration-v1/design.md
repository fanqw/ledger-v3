## Context

P6 数据迁移：V1 MongoDB → V3 PostgreSQL。现有：
- `apps/server/prisma/migrate-from-v1.ts` 待实现（package.json 已挂 `db:migrate-from-v1` 命令）
- Prisma Schema 7 模型（User/Category/Unit/Commodity/PurchasePlace/Order/OrderItem）
- 规格 `data-migration` 定义 6 张 V1 集合迁移（不含 PurchasePlace）
- 无 V1 数据样本，字段映射以规格为准

## Goals / Non-Goals

**Goals:**
- 实现 `migrate-from-v1.ts`：导出 → 转换 → 导入 → 验证 全流程
- ObjectId 映射表维护外键完整
- upsert 幂等（重复执行不产生重复数据）
- 只写 V3，不碰 V1 MongoDB
- 覆盖测试

**Non-Goals:**
- 不迁移 PurchasePlace（规格未要求；V1 订单如引用进货地需单独评估）
- 不做增量/实时同步（一次性全量迁移）
- 不处理 V1 密码哈希格式差异（假设 bcrypt 兼容，验证环节确认）

## Decisions

### D1：导出方式（MongoDB driver vs mongoexport）
- **选择**：Node.js MongoDB driver（`mongodb` 包），脚本内 `client.db().collection().find().toArray()`
- **理由**：规格允许两种；driver 与 ts-node 集成简单，无需外部命令，错误处理内聚
- **备选**：mongoexport → JSON 文件 → 读取 → 多一步文件 IO，否决

### D2：转换映射表
- **ObjectId 转 String**：`String(doc._id)`（MongoDB ObjectId 的 String() 返回 hex 字符串）
- **字段名映射**：`desc→description`、`count→quantity`、`price→unitPrice`、`create_at→createdAt`、`update_at→updatedAt`
- **软删除**：`deleted === true` → `deletedAt = updatedAt`；`false` → `deletedAt = null`
- **User role**：缺失 → `'admin'`
- **collection 映射**：`ordercommodities` → `OrderItem`

### D3：导入顺序与幂等
- **顺序**：User → Category → Unit → Commodity → Order → OrderItem（外键依赖）
- **幂等**：Prisma `upsert`（`where: { id }` + `create` + `update`）
- **映射表**：`Map<v1Id, v3Id>`，处理每条记录时先插映射，外键字段用映射查找
- **密码**：V1 passwordHash 直接复制（假设兼容 bcrypt）

### D4：验证清单
- 记录数：V3（deletedAt null）== V1（deleted false）
- SUM(lineTotal)：V3 == V1
- 外键：所有 OrderItem.orderId/commodityId 能在对应表找到
- 密码：抽样一个 V1 用户用 bcrypt.compare 验证

### D5：测试策略
- `migrate-from-v1.spec.ts`：mock mongodb collection（find().toArray 返回样本），验证：
  - 字段映射正确（desc/count/price/create_at）
  - ObjectId 转 hex、外键映射
  - 幂等（upsert 调用 with id）
  - 软删除转换
- 真实 V1 数据迁移：需用户提供 `V1_MONGO_URL` 后执行（验收时）

## Risks / Trade-offs

- **[V1 数据模型未知]** 无样本，字段名假设来自规格 → 真实迁移前需用 V1 数据预演校验
- **[密码兼容]** V1 密码哈希可能非 bcrypt → 验证环节抽样，失败则需密码重置策略
- **[PurchasePlace 缺失]** V1 订单的进货地不迁移 → 订单 purchasePlaceId 置空，需在文档注明

## Migration Plan

无 Schema 变更。执行：`V1_MONGO_URL=... pnpm --filter server db:migrate-from-v1`。回滚：`pnpm --filter server db:migrate reset`（清空 V3）。

## Open Questions

1. V1 `orders` 是否含进货地/采购地引用？若有，PurchasePlace 迁移需补充
2. V1 密码哈希格式是否为 bcrypt？
