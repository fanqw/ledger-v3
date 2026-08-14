# master-data

## Purpose

定义基础资料（分类、单位、商品、进货地）的 CRUD 行为规格，包括分页搜索、名称唯一约束、删除关联保护、即输即建。

## Purpose

定义基础资料（分类、单位、商品、进货地）的 CRUD 行为规格，包括分页搜索、名称唯一约束、删除关联保护、即输即建。
# master-data
## Requirements
### Requirement: 分类的维护

系统 SHALL 提供分类（Category）的列表展示与创建、读取、更新、删除（软删除，deletedAt 标记）。

#### Scenario: 创建并列出分类

- WHEN 已登录管理员通过 POST /api/categories 创建一条带唯一名称的分类
- THEN 系统 SHALL 持久化该分类，且 GET /api/categories 的默认列表 SHALL 包含该分类

#### Scenario: 逻辑删除分类

- WHEN 已登录管理员通过 DELETE /api/categories/:id 删除某分类，且无未删除商品关联
- THEN 系统 SHALL 设置该分类的 deletedAt 时间戳
- THEN 默认列表查询 SHALL 不再包含该分类

#### Scenario: 名称重复时创建失败

- WHEN 创建或编辑分类时，trim 后的名称与已有未删除分类的名称冲突
- THEN 系统 SHALL 返回 HTTP 409，错误码为 CATEGORY_EXISTS，提示"分类名称已存在"

### Requirement: 单位的维护

系统 SHALL 提供单位（Unit）的列表展示与创建、读取、更新、删除，行为与分类一致（软删除 + 名称唯一）。

#### Scenario: 创建并列出单位

- WHEN 已登录管理员创建一条带唯一名称的单位
- THEN GET /api/units 的默认列表 SHALL 包含该单位

#### Scenario: 名称重复时创建失败

- WHEN 创建或编辑单位时，trim 后的名称与已有未删除单位的名称冲突
- THEN 系统 SHALL 返回 HTTP 409，错误码为 UNIT_EXISTS

### Requirement: 商品的维护与关联约束

系统 SHALL 提供商品（Commodity）的列表展示与创建、读取、更新、删除。每件商品 MUST 关联一条存在的分类与一条存在的单位。

#### Scenario: 创建商品时关联有效主数据

- WHEN 已登录管理员使用存在的 categoryId 与 unitId 创建商品
- THEN 系统 SHALL 持久化该商品，且列表或详情中可解析出其分类与单位关系

#### Scenario: 关联无效主数据时创建失败

- WHEN 使用不存在的 categoryId 或 unitId 创建商品
- THEN 系统 SHALL 返回 HTTP 400（VALIDATION_ERROR），且不得创建不完整商品记录

#### Scenario: 商品名称 + unitId 组合唯一

- WHEN 创建商品时，trim 后的 name + unitId 与已有未删除商品冲突
- THEN 系统 SHALL 返回 HTTP 409，错误码为 COMMODITY_EXISTS

#### Scenario: 逻辑删除商品

- WHEN 删除某商品，且无未删除订单明细关联
- THEN 系统 SHALL 设置 deletedAt，默认列表不再包含该商品

### Requirement: 进货地的维护

系统 SHALL 提供进货地（PurchasePlace）的列表展示与创建、读取、更新、删除。每条记录包含 place（进货地）和 marketName（市场名称），组合唯一。

#### Scenario: 创建并列出进货地

- WHEN 已登录管理员创建一条包含 place 与 marketName 的记录
- THEN GET /api/purchase-places 的列表 SHALL 包含该记录

#### Scenario: place + marketName 组合唯一

- WHEN 创建进货地时，trim 后的 place + marketName 与已有未删除记录冲突
- THEN 系统 SHALL 返回 HTTP 409，错误码为 PURCHASE_PLACE_EXISTS

### Requirement: 主数据删除前的未删除关联保护

系统 SHALL 在删除分类、单位、商品、进货地前检查未删除关联记录；若存在关联，MUST 拒绝删除并返回稳定错误码。

#### Scenario: 分类或单位存在未删除商品关联时删除失败

- WHEN 管理员删除某分类或单位，且存在未删除商品关联该记录
- THEN 系统 SHALL 返回 HTTP 409，错误码为 CATEGORY_IN_USE 或 UNIT_IN_USE

#### Scenario: 商品存在未删除订单明细关联时删除失败

- WHEN 管理员删除某商品，且存在未删除订单明细关联该商品
- THEN 系统 SHALL 返回 HTTP 409，错误码为 COMMODITY_IN_USE

#### Scenario: 进货地存在未删除订单关联时删除失败

- WHEN 管理员删除某进货地，且存在未删除订单关联该进货地
- THEN 系统 SHALL 返回 HTTP 409，错误码为 PURCHASE_PLACE_IN_USE

### Requirement: 主数据列表支持分页与关键字搜索

分类、单位、商品、进货地列表 SHALL 支持 page/pageSize/keyword 查询参数，关键字执行不区分大小写的模糊匹配。

#### Scenario: 分类与单位按名称和备注搜索

- WHEN 用户在分类或单位列表传入 keyword
- THEN 系统 SHALL 对名称与 description 字段执行模糊匹配（ILIKE）

#### Scenario: 商品按名称、分类名、单位名、备注搜索

- WHEN 用户在商品列表传入 keyword
- THEN 系统 SHALL 在商品 name、关联 category.name、关联 unit.name、description 上执行模糊匹配

#### Scenario: 进货地按 place、marketName、description 搜索

- WHEN 用户在进货地列表传入 keyword
- THEN 系统 SHALL 在 place、marketName、description 上执行模糊匹配

### Requirement: 主数据列表默认排序

所有主数据列表 SHALL 默认按 updatedAt 降序排列，并展示 createdAt 与 updatedAt 字段。

#### Scenario: 列表按更新时间倒序

- WHEN 用户访问任意主数据列表且未指定排序参数
- THEN 返回的记录 SHALL 按 updatedAt DESC 排列

### Requirement: 主数据下拉支持搜索与自由输入

前端主数据下拉选择器 SHALL 支持关键字搜索与即输即建（输入内容无匹配时，将用户输入的实际文本作为新记录持久化到数据库）。**这是核心需求，贯穿订单明细创建、商品选择等所有主数据关联场景。**

#### Scenario: 下拉搜索过滤

- WHEN 用户在下拉框中输入关键字
- THEN 系统 SHALL 返回匹配的未删除记录
- THEN 若无完全匹配（trim 后比较），SHALL 在列表首项显示「使用当前输入」选项，该选项的文本内容为用户动态输入的原文字（如用户输入"条"，则显示"条"而非固定的"使用当前输入"文案）

#### Scenario: 通过即输即建创建新记录

- WHEN 用户在下拉中输入"条"且无匹配记录，选择「使用当前输入：条」选项并提交
- THEN 后端 SHALL 在事务内将 trim 后的"条"作为新记录名称持久化到数据库（如新分类或新进货地），并返回新记录的 id
- THEN 该新记录 SHALL 自动关联到当前上下文（如订单明细的 commodityId）

### Requirement: 分类的维护（已实现）
系统 SHALL 提供分类（Category）的列表展示与创建、读取、更新、删除（软删除）。

#### Scenario: CRUD 完整链路
- WHEN 通过 API 创建/查询/更新/删除分类
- THEN 系统 SHALL 返回 `{ success: true, data }` 格式
- THEN 重复名称 SHALL 返回 409 + existingId
- THEN 删除时有商品关联 SHALL 返回 409 CATEGORY_IN_USE

### Requirement: 单位的维护（已实现）
系统 SHALL 提供单位（Unit）的列表展示与创建、读取、更新、删除，行为与分类一致。

#### Scenario: CRUD 完整链路
- WHEN 通过 API 操作单位
- THEN 行为与分类对称，错误码为 UNIT_EXISTS / UNIT_IN_USE

### Requirement: 商品的维护与关联约束（已实现）
系统 SHALL 提供商品（Commodity）的列表展示与创建、读取、更新、删除，关联分类与单位。

#### Scenario: CRUD 完整链路
- WHEN 通过 API 操作商品
- THEN category/unit 关联显示，name+unitId 组合唯一

### Requirement: 进货地的维护（已实现）
系统 SHALL 提供进货地（PurchasePlace）的列表展示与创建、读取、更新、删除，place+marketName 组合唯一。

#### Scenario: CRUD 完整链路
- WHEN 通过 API 操作进货地
- THEN place+marketName 组合唯一，删除时检查订单关联

### Requirement: 分页与关键字搜索（已实现）
所有主数据列表 SHALL 支持 page/pageSize/keyword 查询参数。

#### Scenario: 分页搜索
- WHEN 在列表 API 传入分页参数和关键字
- THEN 返回 `{ items, meta: { page, pageSize, total } }`

### Requirement: 前端管理页面（已实现）
系统 SHALL 提供 4 个主数据管理页面，支持表格分页、搜索、新增/编辑弹窗、删除二次确认。

#### Scenario: 页面交互
- WHEN 用户访问 /categories、/units、/commodities、/purchase-places
- THEN 页面渲染完整的数据表格、搜索框、CRUD 弹窗

### Requirement: 即输即建下拉组件（已实现）
系统 SHALL 提供 CreatableSelect 组件，支持输入文本无匹配时即输即建新记录。

#### Scenario: 即输即建
- WHEN 用户在下拉中输入无匹配文本
- THEN 显示「使用当前输入：{文本}」，选择后自动创建并选中

