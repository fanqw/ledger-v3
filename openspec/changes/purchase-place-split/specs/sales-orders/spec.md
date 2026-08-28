# Spec: sales-orders（订单关联市场）

## Requirement: 订单关联市场

订单的进货地字段由 `purchasePlaceId`（关联 PurchasePlace）改为 `marketId`（关联 Market）。

- WHEN 创建/编辑订单，传 `marketId` 指向不存在的市场
- THEN 返回 HTTP 422 `VALIDATION_ERROR`

- WHEN 传 `marketId: null`
- THEN 清空订单的市场关联（显式断开）

- WHEN 查询订单列表/详情
- THEN 返回 `market` 对象（含 `name` 与所属 `city.place`），如 `{ name: '长治市场', city: { place: '晋城' } }`

- WHEN 订单列表传入 keyword
- THEN 在 `name`、`description`、关联 `market.name`、`market.city.place` 上执行模糊匹配
