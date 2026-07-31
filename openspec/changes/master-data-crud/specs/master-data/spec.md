## ADDED Requirements

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
