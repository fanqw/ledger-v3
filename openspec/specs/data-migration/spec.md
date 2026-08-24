# data-migration

## Purpose

定义 V1 MongoDB 到 V3 PostgreSQL 的数据迁移行为规格，包括导出-转换-导入三步策略、ObjectId 映射、幂等设计、验证与回滚。


## Purpose

定义 V1 MongoDB 到 V3 PostgreSQL 的数据迁移行为规格，包括导出→转换→导入三步策略、ObjectId 映射、幂等设计、验证与回滚。
# data-migration

## Requirements

### Requirement: V1 MongoDB 数据导出

系统 SHALL 支持从 V1 MongoDB 导出业务数据，导出格式为 JSON（通过 mongoexport 或 Node.js MongoDB driver 读取）。

#### Scenario: 导出全部 V1 数据

- WHEN 执行导出脚本，提供有效的 V1_MONGO_URL 环境变量
- THEN 系统 SHALL 从 V1 MongoDB 读取 users、categories、units、commodities、orders、ordercommodities 六张表的数据
- THEN 导出过程 SHALL 以只读方式操作，不修改 V1 数据

### Requirement: 数据映射与转换

迁移脚本 SHALL 将 V1 MongoDB 数据转换为 V3 PostgreSQL 的 Prisma Schema 格式。

#### Scenario: ObjectId 转 String

- WHEN 遇到 MongoDB 的 _id (ObjectId) 字段
- THEN 脚本 SHALL 调用 .toString() 转为 24 位 hex 字符串，作为 V3 记录的 id

#### Scenario: 字段名映射

- WHEN 遇到 V1 字段 desc
- THEN 脚本 SHALL 映射为 V3 字段 description
- WHEN 遇到 V1 字段 count
- THEN 脚本 SHALL 映射为 V3 字段 quantity
- WHEN 遇到 V1 字段 price
- THEN 脚本 SHALL 映射为 V3 字段 unitPrice

#### Scenario: 软删除字段转换

- WHEN V1 记录的 deleted 为 false
- THEN V3 记录的 deletedAt SHALL 为 null
- WHEN V1 记录的 deleted 为 true
- THEN V3 记录的 deletedAt SHALL 取该记录的 updatedAt 值

#### Scenario: 时间字段映射

- WHEN 遇到 V1 字段 create_at / update_at
- THEN 脚本 SHALL 映射为 V3 字段 createdAt / updatedAt

#### Scenario: User 角色默认值

- WHEN V1 User 记录没有 role 字段
- THEN V3 记录的 role SHALL 默认设为 "admin"

#### Scenario: 模型名映射

- WHEN 遇到 V1 collection ordercommodities
- THEN 脚本 SHALL 将数据映射到 V3 的 OrderItem 表

### Requirement: 外键关联保持

迁移脚本 SHALL 维护外键引用的完整性：将所有 ObjectId 外键转为 hex 字符串后，确保引用目标记录在 V3 中存在。

#### Scenario: ID 映射表维护

- WHEN 迁移脚本处理每条记录
- THEN 脚本 SHALL 维护一张旧 ObjectId hex → 新 id 的映射表
- THEN 所有外键字段 SHALL 通过映射表查找对应记录的新 id

#### Scenario: 按依赖顺序迁移

- WHEN 执行迁移
- THEN 脚本 SHALL 按 User → Category → Unit → Commodity → Order → OrderItem 顺序处理，确保外键引用的记录已存在

### Requirement: 幂等性

迁移脚本 SHALL 支持重复执行，使用 upsert 确保已有记录不重复插入。

#### Scenario: 重复执行不产生重复数据

- WHEN 迁移脚本第二次执行
- THEN 已存在的记录 SHALL 被覆盖更新（以 id 为唯一键）
- THEN 不会产生重复记录

### Requirement: 迁移验证

迁移完成后 SHALL 执行验证清单，确保数据完整性。

#### Scenario: 记录数验证

- WHEN 迁移完成后执行验证
- THEN 各表 V3 排除 deletedAt IS NOT NULL 的记录数 SHALL 与 V1 排除 deleted=true 的记录数一致

#### Scenario: 金额汇总验证

- WHEN 迁移完成后
- THEN V3 中 SUM(lineTotal) SHALL 与 V1 中 SUM(lineTotal) 一致

#### Scenario: 外键完整性验证

- WHEN 迁移完成后
- THEN 所有 OrderItem.orderId SHALL 能在 V3 Order 表中找到对应记录
- THEN 所有 OrderItem.commodityId SHALL 能在 V3 Commodity 表中找到对应记录

#### Scenario: 密码可登录验证

- WHEN 迁移完成后
- THEN 用 V1 用户的用户名和密码 SHALL 能在 V3 成功登录

### Requirement: 回滚方案

迁移脚本 SHALL 只写 V3 库，不修改 V1 MongoDB。如有问题可通过重置 V3 数据库回滚。

#### Scenario: 重置 V3 数据库

- WHEN 需要回滚迁移
- THEN 执行 prisma migrate reset --force SHALL 清空 V3 数据库
- THEN V1 系统 SHALL 继续独立运行，不受影响

### Requirement: 迁移脚本可执行

迁移脚本 SHALL 通过统一的 pnpm 命令执行，位置为 apps/server/prisma/migrate-from-v1.ts。

#### Scenario: 通过 pnpm 命令执行迁移

- **WHEN** 设置 V1_MONGO_URL 环境变量后执行 pnpm --filter server db:migrate-from-v1
- **THEN** 迁移 SHALL 按顺序执行所有步骤（导出 → 转换 → 导入 → 验证）
- **THEN** 执行完成 SHALL 输出迁移统计摘要

#### Scenario: 迁移脚本实现落地

- **WHEN** 执行 db:migrate-from-v1 命令
- **THEN** `apps/server/prisma/migrate-from-v1.ts` SHALL 存在且可执行
- **THEN** 脚本 SHALL 通过 Node.js MongoDB driver 读取 V1 数据（无需外部 mongoexport）
- **THEN** 导入 SHALL 使用 Prisma upsert（以 id 为唯一键）保证幂等
- **THEN** 迁移 SHALL 仅写 V3 数据库，不修改 V1 MongoDB

#### Scenario: 外键关联保持

- **WHEN** 迁移脚本处理每条记录
- **THEN** 脚本 SHALL 维护旧 ObjectId hex → 新 id 的映射表，外键字段通过映射查找
- **THEN** 迁移 SHALL 按 User → Category → Unit → Commodity → Order → OrderItem 顺序处理

#### Scenario: 验证清单

- **WHEN** 迁移完成后
- **THEN** 各表 V3（deletedAt IS NULL）记录数 SHALL 与 V1（deleted=false）一致
- **THEN** V3 与 V1 的 SUM(lineTotal) SHALL 一致
- **THEN** 所有 OrderItem.orderId / commodityId SHALL 在对应表存在
- **THEN** 抽样 V1 用户密码 SHALL 能在 V3 成功登录（bcrypt 兼容）

#### Scenario: 回滚方案

- **WHEN** 需要回滚迁移
- **THEN** 执行 prisma migrate reset --force SHALL 清空 V3 数据库
- **THEN** V1 系统 SHALL 继续独立运行，不受影响
