## MODIFIED Requirements

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
