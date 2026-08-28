# Spec: master-data（进货地拆分）

## Requirement: 进货地（城市）维护

系统 SHALL 提供进货地（PurchasePlace）的列表展示与创建、读取、更新、删除。每条记录包含 `place`（城市名）与 `description`（可选），`place` 唯一。

- WHEN 创建进货地时，trim 后 `place` 与已有未删除记录冲突
- THEN 返回 HTTP 409，错误码 `PURCHASE_PLACE_EXISTS`

- WHEN 删除某进货地，且存在未删除市场关联该进货地
- THEN 返回 HTTP 409，错误码 `PURCHASE_PLACE_IN_USE`

- WHEN 列表传入 keyword
- THEN 在 `place`、`description` 上执行不区分大小写模糊匹配

## Requirement: 市场（Market）维护

系统 SHALL 提供市场（Market）的列表展示与创建、读取、更新、删除。每条记录包含 `name`（市场名）、`cityId`（关联进货地城市）、`description`（可选），`name` 唯一。

- WHEN 创建市场时，`cityId` 指向不存在的城市
- THEN 返回 HTTP 422 `VALIDATION_ERROR`

- WHEN 创建市场时，trim 后 `name` 与已有未删除记录冲突
- THEN 返回 HTTP 409，错误码 `MARKET_EXISTS`

- WHEN 删除某市场，且存在未删除订单关联该市场
- THEN 返回 HTTP 409，错误码 `MARKET_IN_USE`

- WHEN 列表传入 keyword
- THEN 在 `name`、关联 `city.place`、`description` 上执行模糊匹配

## Requirement: 超市（Supermarket）维护

系统 SHALL 提供超市（Supermarket）的列表展示与创建、读取、更新、删除。每条记录包含 `name` 与 `description`（可选），`name` 唯一。

- WHEN 创建超市时，trim 后 `name` 与已有未删除记录冲突
- THEN 返回 HTTP 409，错误码 `SUPERMARKET_EXISTS`

- WHEN 删除某超市
- THEN 直接软删除（无引用检查）

- WHEN 列表传入 keyword
- THEN 在 `name`、`description` 上执行模糊匹配
