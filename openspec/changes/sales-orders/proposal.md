# Proposal: sales-orders

## Summary

实现订单管理（Order + OrderItem）的后端模块与前端页面，包括订单分页搜索与 CRUD、明细嵌套 CRUD（含即输即建主数据）、lineTotal 联动与标红、按分类分组的订单详情表格、Excel 导出，以及统一 API 响应格式。

## Motivation

P0-P3 已完成项目骨架、认证鉴权、布局壳、四类基础资料 CRUD 和即输即建下拉组件，但系统尚无订单入口。P4 是核心业务链路「进货地 → 订单 → 明细」的最后一环——用户需要创建订单、录入明细（引用已有商品或即输即建新商品），并导出对账 Excel。P3 交付的 CreatableSelect 组件和共享 Zod Schema 已为 P4 做好了基础设施准备。

## Scope

### In Scope
- **Order 订单管理**：分页列表（支持 keyword 搜索 name/purchasePlace/description）、创建（可选 purchasePlaceId）、编辑（PATCH）、软删除（检查未删除明细）
- **OrderItem 明细管理**（嵌套路由 `/api/orders/:orderId/items`）：
  - 添加明细：支持引用已有商品（commodityId）或即输即建主数据（在事务内创建 category/unit/commodity → 写入明细）
  - 编辑明细：支持手动修改 lineTotal（原样持久化，不重新计算）
  - 软删除明细
- **lineTotal 联动**：创建时默认 quantity × unitPrice 舍入到 2 位小数；手动指定不同于计算值时前端表格标红
- **订单详情表格**：按分类分组、合并单元格（分类列 + 分类金额列）、分类小计、订单总计
- **Excel 导出**：前端使用 exceljs 生成，含合并单元格、分类小计行、标红行
- **共享 Schema 扩充**：新增 orderCreateSchema、orderUpdateSchema、orderItemCreateSchema（含即输即建 `.refine()` 校验）、orderItemUpdateSchema
- **共享错误码**：复用已有 ORDER_EXISTS、ORDER_HAS_ITEMS、NOT_FOUND、VALIDATION_ERROR
- **响应格式**：统一 `{ success: true, data }` / `{ success: false, error: { code, message } }`，与已有模块保持一致
- **JWT 鉴权**：所有端点使用 JwtAuthGuard
- **Swagger 文档**：使用 @ApiTags / @ApiOperation / @ApiBearerAuth 装饰器
- **Jest 单元测试**：OrderService 至少覆盖 21 个场景（分页搜索、CRUD 成功/冲突/不存在、即输即建事务、lineTotal 计算）

### Out of Scope
- 订单统计/分析（P5）
- 批量导入/导出
- 订单审批工作流
- 权限细分（当前所有登录用户均可访问）
- 后端 Excel 生成（前端导出已满足需求，数据量小无需服务端处理）
- E2E 测试（当前项目无 E2E 基础设施）

## Impact

| 层 | 变更 |
|----|------|
| Backend | 新增 `apps/server/src/modules/order/` — order.module.ts, order.controller.ts, order.service.ts, __tests__/order.service.spec.ts |
| Backend | 修改 `apps/server/src/app.module.ts` — 引入 OrderModule |
| Backend | 修改 `apps/server/src/app.module.spec.ts` — 添加 OrderModule 断言 |
| Frontend | 新增 `apps/web/src/pages/Orders.tsx` — 订单列表页 |
| Frontend | 新增 `apps/web/src/pages/OrderDetail.tsx` — 订单详情页（含明细表格 + 即输即建弹窗 + Excel 导出） |
| Frontend | 修改 `apps/web/src/App.tsx` — 注册 `/orders` 和 `/orders/:id` 路由，替换占位符 |
| Frontend | 新增依赖 `exceljs` 到 `apps/web` |
| Shared | 修改 `packages/shared/src/validators/index.ts` — 新增 4 个 Schema |
| Shared | 无需新增错误码（已有 ORDER_EXISTS、ORDER_HAS_ITEMS 覆盖核心场景） |

## Risks

- **即输即建并发冲突**：两个用户同时创建同名 category/unit/commodity → 事务回滚。解法：即输即建全流程在 Prisma `$transaction` 中执行，唯一约束冲突自动回滚，前端可重试
- **Decimal 精度**：quantity(12,3) × unitPrice(12,2) 可能产生超过 2 位小数。解法：lineTotal 使用 `Math.round(value * 100) / 100` 舍入到 2 位，与 Prisma Decimal(12,2) 精度对齐
- **Prisma Decimal 序列化**：`@prisma/client` 的 Decimal 类型 JSON 序列化为 `{ s, e, d }` 而非数字。解法：Service 层返回前通过 `Number()` 转换
- **Excel 生成性能**：当前数据量千级，浏览器端 exceljs 足够。若日后数据增长，可考虑迁移到后端生成
- **即输即建事务中的 FK 依赖**：创建 commodity 前必须先有 category 和 unit。解法：在事务内按 category → unit → commodity 顺序解析/创建，确保依赖关系
- **订单名称唯一性范围**：当前为全局唯一（不分 purchasePlace）。与 Commodity 的 name+unitId 组合唯一模式不同，需在 Service 层明确实现
