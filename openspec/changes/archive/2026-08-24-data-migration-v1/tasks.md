## 1. 前置准备

- [ ] 1.1 从 `origin/main` 创建分支 `feature/p6-data-migration`
- [ ] 1.2 安装 `mongodb` driver 依赖（apps/server）

## 2. 迁移脚本实现

- [ ] 2.1 导出：连接 V1_MONGO_URL，读取 6 集合（只读）
- [ ] 2.2 转换：ObjectId → hex、字段名映射（desc/count/price/create_at/update_at）、软删除、role 默认
- [ ] 2.3 映射表：维护 v1Id → v3Id，外键查找
- [ ] 2.4 导入：按 User → Category → Unit → Commodity → Order → OrderItem 顺序 + upsert 幂等
- [ ] 2.5 验证：记录数、SUM(lineTotal)、外键、密码抽样
- [ ] 2.6 输出迁移统计摘要

## 3. 测试

- [ ] 3.1 `migrate-from-v1.spec.ts`：mock mongodb collection，验证字段映射/ObjectId/幂等/软删除
- [ ] 3.2 运行 `pnpm --filter server test -- --testPathPattern="migrate"` 通过

## 4. 验证与收尾

- [ ] 4.1 全量测试 + lint + build 通过
- [ ] 4.2 （可选）用户提供 V1_MONGO_URL 后真实迁移预演
- [ ] 4.3 提交 + PR → review → 合入 main
- [ ] 4.4 用 `openspec-sync-specs` 同步主规格并归档 change
