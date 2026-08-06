# sales-orders

## Purpose

定义订单与订单明细的 CRUD 行为规格，包括即输即建主数据、lineTotal 联动、分类小计、Excel 导出、统一 API 响应格式。


## Purpose

定义订单与订单明细的 CRUD 行为规格，包括即输即建主数据、lineTotal 联动、分类小计、Excel 导出、统一 API 响应格式。
# sales-orders

## Requirements

### Requirement: 订单的维护

系统 SHALL 提供订单（Order）的列表与详情展示，以及创建、读取、更新、删除能力。订单 MUST 包含名称（必填），可关联进货地（purchasePlaceId，可选）。删除采用软删除。

#### Scenario: 创建并列出订单

- WHEN 已登录管理员通过 POST /api/orders 创建一条带名称的订单（可选 purchasePlaceId）
- THEN GET /api/orders 的列表 SHALL 包含该订单，包含 name、purchasePlace 信息、createdAt、updatedAt

#### Scenario: 订单列表支持搜索

- WHEN 用户在订单列表传入 keyword
- THEN 系统 SHALL 在订单 name、关联 purchasePlace.place、purchasePlace.marketName、description 上执行模糊匹配

#### Scenario: 订单列表分页

- WHEN 请求 GET /api/orders?page=2&pageSize=20
- THEN 系统 SHALL 返回第二页数据，meta 包含 page、pageSize、total

#### Scenario: 查看订单详情

- WHEN 已登录管理员请求 GET /api/orders/:orderId
- THEN 系统 SHALL 返回该订单的 id、name、purchasePlace、description、items（明细列表）、createdAt、updatedAt

#### Scenario: 编辑订单

- WHEN 已登录管理员通过 PATCH /api/orders/:orderId 修改订单名称或进货地
- THEN 系统 SHALL 更新该订单的字段并返回更新后的订单

#### Scenario: 订单名称唯一

- WHEN 创建或编辑订单时 name 与已有未删除订单冲突
- THEN 系统 SHALL 返回 HTTP 409，错误码为 ORDER_EXISTS

#### Scenario: 订单删除前检查明细

- WHEN 管理员删除某订单，且该订单下存在未删除的明细（OrderItem）
- THEN 系统 SHALL 返回 HTTP 409，错误码为 ORDER_HAS_ITEMS，提示"请先删除所有明细"

### Requirement: 订单明细的维护与关联

系统 SHALL 提供订单明细（OrderItem）的增删改查。每条明细 MUST 关联一条存在的订单与一条存在的商品，并包含 quantity、unitPrice、lineTotal、description。

#### Scenario: 为订单添加明细（引用已有商品）

- WHEN 已登录管理员通过 POST /api/orders/:orderId/items 创建明细，提供存在的 commodityId、quantity、unitPrice、可选 lineTotal
- THEN 系统 SHALL 持久化该明细，lineTotal 默认为 quantity × unitPrice 的舍入值
- THEN 订单详情中的明细列表 SHALL 包含该记录

#### Scenario: 为订单添加明细（即输即建主数据）

- WHEN 管理员创建明细时不提供 commodityId，而是提供分类/单位标识（id 或名称）与商品名称
- THEN 系统 SHALL 解析或创建主数据（分类/单位/商品），再写入明细
- THEN 基础数据创建失败时 SHALL 终止整个明细创建流程，不创建 OrderItem

#### Scenario: OrderItem 创建失败时保留基础数据

- WHEN category、unit、commodity 已成功创建，但后续 OrderItem 创建失败
- THEN 系统 SHALL 不回滚已创建的基础数据（它们是合法的新业务记录）
- THEN 系统 SHALL 返回 OrderItem 创建失败的错误信息

#### Scenario: 即输即建时分类/单位必填

- WHEN 即输即建新商品（不提供 commodityId）
- THEN 系统 SHALL 要求同时提供分类和单位（id 或名称）
- THEN 缺失分类或单位时 SHALL 返回校验错误，拒绝创建

#### Scenario: 名称 trim 后为空时拒绝

- WHEN 即输即建时，商品名称 trim 后为空
- THEN 系统 SHALL 返回 HTTP 422（VALIDATION_ERROR），拒绝创建

#### Scenario: 编辑明细

- WHEN 管理员通过 PATCH /api/orders/:orderId/items/:itemId 修改 quantity、unitPrice 或 lineTotal
- THEN 系统 SHALL 更新该明细；若提供了 lineTotal，SHALL 按提交值原样持久化（不重新计算）

#### Scenario: 逻辑删除订单明细

- WHEN 管理员通过 DELETE /api/orders/:orderId/items/:itemId 删除明细
- THEN 系统 SHALL 设置 deletedAt，默认明细列表不再包含该记录

### Requirement: lineTotal 联动与标红判定

明细的 lineTotal 字段 SHALL 与 quantity、unitPrice 保持联动。前端表格和 Excel 导出中，lineTotal 与标准计算值（quantity × unitPrice 舍入）不相等时 SHALL 标红。

#### Scenario: 创建时默认 lineTotal

- WHEN 创建明细时提供 quantity 和 unitPrice 但未提供 lineTotal
- THEN 系统 SHALL 将 lineTotal 设为 quantity × unitPrice 的舍入值

#### Scenario: 手动修改 lineTotal 后标红

- WHEN 用户手动指定 lineTotal 不同于 quantity × unitPrice 的舍入值
- THEN 前端表格中该行的"金额"列 SHALL 以红色显示
- THEN Excel 导出中对应单元格 SHALL 标红

### Requirement: 订单详情页表格展示

订单详情页的明细表格 SHALL 按分类分组，对"分类"列与"分类金额"列做合并单元格展示，并在首行显示订单总金额。

#### Scenario: 表格列结构与合并

- WHEN 用户查看订单详情
- THEN 明细表格 SHALL 包含以下列：分类 → 名称 → 数量 → 单位 → 单价 → 金额 → 备注 → 分类金额 → 总金额 → 操作
- THEN "分类"列与"分类金额"列 SHALL 按分类分组纵向合并单元格
- THEN "总金额"列 SHALL 仅在首行显示并合并至全部明细行

#### Scenario: 分类小计与订单总计

- WHEN 明细列表加载完成
- THEN 每个分类分组 SHALL 显示该分类下所有明细 lineTotal 之和
- THEN 订单总计 SHALL 显示所有明细 lineTotal 之和

### Requirement: Excel 导出

系统 SHALL 支持将订单详情导出为 Excel 文件，包含合并单元格、分类小计、金额标红等格式。

#### Scenario: 导出含格式的 Excel

- WHEN 管理员触发订单详情页的"导出 Excel"操作
- THEN 系统 SHALL 生成 .xlsx 文件，包含合并单元格、分类小计行、标红行
- THEN 文件名 SHALL 包含订单名称

### Requirement: 统一的 API 响应格式

所有 API 响应 SHALL 遵循统一格式：成功返回 `{ success: true, data: T }`，列表返回 `{ success: true, data: { items: T[], meta: { page, pageSize, total } } }`，失败返回 `{ success: false, error: { code, message } }`。

#### Scenario: 创建成功响应

- WHEN 任意 POST 请求成功创建资源
- THEN 系统 SHALL 返回 HTTP 200/201，响应体为 `{ success: true, data: { ... } }`

#### Scenario: 校验失败响应

- WHEN 请求参数不合法（如缺少必填字段、格式错误）
- THEN 系统 SHALL 返回 HTTP 422，错误码为 VALIDATION_ERROR，message 为中文描述

### Requirement: Zod 参数校验（前后端共享 Schema）

系统 SHALL 使用 Zod 定义请求参数的校验 Schema，Schema 定义放在 `packages/shared/src/validators/` 中，前后端共享引用。后端 NestJS 通过 ZodPipe 或自定义装饰器执行校验，前端在表单提交前执行客户端校验。

#### Scenario: 共享 Schema 前后端一致

- WHEN 前端提交创建订单请求
- THEN 前端 SHALL 使用与后端相同的 Zod Schema 对必填字段、格式、trim 后空值做客户端校验
- THEN 后端 SHALL 使用相同 Schema 再次校验，拒绝不合法请求并返回 422

#### Scenario: Schema 变更时自动同步

- WHEN `packages/shared` 中的 Zod Schema 发生变更
- THEN 前端和后端 SHALL 同时获得最新的校验规则（通过 monorepo workspace 引用）

### Requirement: 表单校验与错误提示

前端表单 SHALL 对必填字段、格式校验、trim 后空值等做字段级校验，并提供错误文本组件展示错误信息。

#### Scenario: 必填字段为空时阻止提交

- WHEN 用户在表单中未填写必填字段（如订单名称）并尝试提交
- THEN 前端 SHALL 阻止提交并在对应字段下显示红色错误提示

### Requirement: 操作反馈

所有增删改操作 SHALL 提供 loading 状态、成功提示和失败提示。

#### Scenario: 删除操作二次确认

- WHEN 管理员点击任意删除按钮
- THEN 系统 SHALL 弹出确认对话框"确定要删除吗？"
- THEN 确认后执行删除，完成后显示成功提示
