# Design: sales-orders

## API 设计

### 通用约定
- 所有端点需 JWT 鉴权（`@UseGuards(JwtAuthGuard)`，继承已有全局守卫）
- 成功响应格式：`{ success: true, data: T }`
- 列表响应格式：`{ success: true, data: { items: T[], meta: { page, pageSize, total } } }`
- 失败响应格式：`{ success: false, error: { code: string, message: string } }`
- 错误码复用 `packages/shared/src/constants/` 中的 `ERROR_CODES` 和 `ERROR_MESSAGES`
- 所有输入通过 `ZodValidationPipe` 校验，Schema 定义在 `packages/shared/src/validators/`
- DELETE 成功返回 `{ success: true, data: null }`（HTTP 200）
- 软删除：设置 `deletedAt`，列表默认过滤 `deletedAt: null`
- 明细路由嵌套在订单下：`/api/orders/:orderId/items`
- Decimal 字段（quantity, unitPrice, lineTotal）在 HTTP 响应中转换为 number

### Order 端点

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | 分页列表 `?page=1&pageSize=20&keyword=` |
| GET | `/api/orders/next-name` | 获取默认订单名称 `{ data: { name: "20260803-01" } }` — 前端打开新增弹窗时调用，后端统计当天已有订单数+1 生成，序号补零到 2 位 |
| GET | `/api/orders/:id` | 订单详情（含 purchasePlace + items[commodity+category+unit] + isModified 标记） |
| POST | `/api/orders` | 创建订单 `{ name, purchasePlaceId?, description? }` |
| PATCH | `/api/orders/:id` | 更新订单 `{ name?, purchasePlaceId?, description? }` |
| DELETE | `/api/orders/:id` | 软删除（检查未删除明细 → ORDER_HAS_ITEMS） |

### OrderItem 端点（嵌套路由）

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders/:orderId/items` | 添加明细（引用已有商品 或 即输即建） |
| PATCH | `/api/orders/:orderId/items/:itemId` | 更新明细 `{ quantity?, unitPrice?, lineTotal?, description? }` |
| DELETE | `/api/orders/:orderId/items/:itemId` | 软删除明细 |

### 订单名称默认值

订单名称默认格式：`YYYYMMDD-[序号]`

- 前端打开新增订单弹窗时，调用 `GET /api/orders/next-name` 获取默认名称
- 后端统计 `deletedAt IS NULL AND createdAt >= 当天 00:00:00` 的订单数 count，序号 = count + 1，补零到 2 位
- 示例：当天 0 条 → `20260803-01`，已有 1 条 → `20260803-02`
- 用户可手动修改名称，提交时仍需通过唯一性校验

### 订单搜索

keyword 参数同时在以下字段模糊匹配（case-insensitive）：
- `Order.name`
- `Order.description`
- `PurchasePlace.place`（关联表）
- `PurchasePlace.marketName`（关联表）

### lineTotal 双向联动

**核心规则**：lineTotal 必填。前端支持双向联动——修改单价重算金额，修改金额反向算单价。

| 触发场景 | 行为 |
|---------|------|
| 修改 quantity | 自动重算 lineTotal = `Math.round(quantity × unitPrice × 100) / 100`（无论之前是否手动改过 lineTotal，均恢复默认联动，清除标红状态） |
| 修改 unitPrice | **同上**——自动重算 lineTotal = `Math.round(quantity × unitPrice × 100) / 100`，清除标红状态 |
| 手动修改 lineTotal，且 |lineTotal − quantity×unitPrice| > 0.005 | **① 金额字体标红**（前端 text-red-600）**② 反向计算单价** = lineTotal / quantity（舍入到 2 位），更新 unitPrice 字段 |
| 手动修改 lineTotal，但值与 quantity×unitPrice 一致 | 无特殊处理，正常显示 |

**前端交互流程**：
1. 用户填入 quantity → lineTotal 自动计算（灰色或默认色）
2. 用户填入 unitPrice → lineTotal 自动计算，同上
3. 用户手动修改 lineTotal → 若与计算值不一致：①金额输入框变红 ②unitPrice 自动更新为 lineTotal/quantity 的舍入值
4. 用户再次修改 quantity **或 unitPrice** → lineTotal 重新按 quantity×unitPrice 计算（恢复到默认联动，**清除标红状态**）
5. 提交到后端时 lineTotal 均为必填字段

**标红判定**（后端计算 + 前端展示）：后端在 `findById` 响应中计算 `computedLineTotal = Math.round(quantity × unitPrice × 100) / 100`，标记 `isModified = |lineTotal - computedLineTotal| > 0.005`。前端表格和 Excel 中 isModified===true 时金额列 `text-red-600`。后端对提交的 lineTotal 和 unitPrice 按原值存储，不做反向计算。

### 即输即建流程（重新设计）

**数据来源**：商品、分类、单位三个下拉框的数据均来自已有的基础资料 API。默认请求前 100 条，搜索时返回搜索结果的前 100 条。下拉列表支持滚动加载更多（每页 100 条），用户滚动到底部时自动加载下一页。

**3.1 正常流程（引用已有商品）**：
1. 用户在商品下拉框搜索/选择已有商品（数据来源：`/api/commodities`）
2. 选中后自动填入该商品关联的 `categoryId` 和 `unitId`，分类和单位下拉框自动回显对应名称
3. 用户修改数量、单价
4. lineTotal 自动计算（可手动修改触发反向联动）
5. 提交

**3.2 即输即建流程（商品不存在或需新建关联）**：

前端弹窗不分 RadioToggle 模式——统一交互：

1. 用户在下拉框中输入搜索文本
   - 有匹配商品 → 点击选中 → 自动带出分类+单位
   - 无匹配商品 → 用户输入的文本即为新商品名称
2. 分类字段：带出已有值（若通过商品带出），用户可：
   - 保留已有值
   - 搜索选择其他已有分类
   - 输入新分类名称（搜索无结果时，用户输入作为新分类）
3. 单位字段：同分类逻辑
4. 用户填写数量、单价
5. lineTotal 自动计算（可手动修改）
6. 提交

**3.3 后端创建策略（关键：基础数据不回滚）**：

```
POST /api/orders/:orderId/items
│
├── 1. 解析/创建 Category
│   ├── 有 categoryId → 校验存在
│   └── 有 categoryName → findFirst 或 create（名称 trim）
│   └── 失败 → 返回错误，终止整个流程
│
├── 2. 解析/创建 Unit
│   ├── 有 unitId → 校验存在
│   └── 有 unitName → findFirst 或 create（名称 trim）
│   └── 失败 → 返回错误，终止整个流程
│
├── 3. 解析/创建 Commodity
│   ├── 有 commodityId → 校验存在
│   └── 有 commodityName → 按 name+unitId findFirst 或 create
│   └── 失败 → 返回错误，终止整个流程
│
└── 4. 创建 OrderItem
    ├── 关联 commodityId + orderId
    ├── 失败 → ⚠️ 不回滚 1-3 中已创建的基础数据（Category/Unit/Commodity 是合法新记录）
    └── 成功 → 返回创建的 OrderItem
```

**关键设计决策**：
- **不使用单一事务**包裹全部步骤。基础数据（category/unit/commodity）逐条独立创建
- OrderItem 创建失败时，已创建的基础数据保留（它们是有效的业务数据，不应被回滚）
- 基础数据任一步骤失败时，返回明确错误（含具体是哪个实体创建失败），不继续后续步骤
- Category/Unit/Commodity 创建使用普通的 `prisma.create`（或 findFirst → create 的二段式逻辑），不做额外的并发冲突处理——若唯一约束冲突由 Prisma 抛出，前端收到错误后引导用户重试

### 详情响应中的 isModified 标记

`GET /api/orders/:id` 的响应中，每个 OrderItem 附加：
- `isModified: boolean` — `|lineTotal - computedLineTotal| > 0.005` 时为 true
- `computedLineTotal: number` — `Math.round(quantity × unitPrice × 100) / 100`

前端以此决定「金额」列是否标红，Excel 导出同理。

## 数据库 Schema

无需变更。Order 和 OrderItem 模型已存在于 `apps/server/prisma/schema.prisma`：

- **Order**: id, name, description?, purchasePlaceId?(FK → PurchasePlace, onDelete: Restrict), items(OrderItem[]), createdAt, updatedAt, deletedAt? — @@index([purchasePlaceId]), @@index([name])
- **OrderItem**: id, orderId(FK → Order), commodityId(FK → Commodity), quantity(Decimal 12,3), unitPrice(Decimal 12,2), lineTotal(Decimal 12,2), description?, createdAt, updatedAt, deletedAt? — @@index([orderId]), @@index([commodityId])

**注意**：Order 无 `@@unique([name, deletedAt])` 约束——名称唯一性在 Service 业务层软删除感知地实现。

## 共享 Schema 扩充

在 `packages/shared/src/validators/index.ts` 中新增以下 Schema（保留已有 `orderSchema`、`orderItemSchema` 作为向后兼容别名）：

### orderCreateSchema
```typescript
z.object({
  name: z.string().trim().min(1).max(100),
  purchasePlaceId: idSchema.optional(),
  description: z.string().trim().max(500).optional(),
})
```
- `name` 增加 `max(100)` 限制，与其他实体对齐
- `purchasePlaceId` 复用 `idSchema` 格式校验

### orderUpdateSchema
```typescript
orderCreateSchema.partial()
```

### orderItemCreateSchema
```typescript
z.object({
  commodityId: idSchema.optional(),
  commodityName: z.string().trim().min(1).max(100).optional(),
  categoryId: idSchema.optional(),
  categoryName: z.string().trim().min(1).max(100).optional(),
  unitId: idSchema.optional(),
  unitName: z.string().trim().min(1).max(100).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),   // 必填（前端自动计算后提交）
  description: z.string().trim().max(500).optional(),
})
.refine(data => !!data.commodityId || !!data.commodityName,
  { message: '必须提供 commodityId 或 commodityName', path: ['commodityId'] })
```
- `lineTotal` 由 `optional()` 改为**必填**——前端自动计算默认值后提交，用户手动修改的也一并提交
- 移除第二条 refine（即输即建时不再强制要求 unit/category）——用户可通过已有商品带出关联，也可手动输入新分类/单位

### orderItemUpdateSchema
```typescript
z.object({
  quantity: z.number().positive().optional(),
  unitPrice: z.number().nonnegative().optional(),
  lineTotal: z.number().nonnegative().optional(),
  description: z.string().trim().max(500).optional(),
})
```

## 后端模块结构

```text
apps/server/src/modules/order/
├── order.module.ts
├── order.controller.ts      # 订单 CRUD + 明细 CRUD（嵌套路由）+ next-name 端点
├── order.service.ts         # 订单 + 明细所有业务逻辑
└── __tests__/
    └── order.service.spec.ts
```

**决策**：OrderItem 逻辑放在 order.service.ts 中，不做独立 service。

**模块注册**：
```typescript
@Module({
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
```

AppModule 的 `imports` 中添加 `OrderModule`。

## 前端组件树

```
AppShell (已有)
├── /orders → OrdersPage (新增)
│   ├── PageHeader ("订单管理" + 新增按钮 → 先调 GET /api/orders/next-name 获取默认名称再打开弹窗)
│   ├── SearchInput（防抖 300ms，搜索订单 name/purchasePlace/description）
│   ├── DataTable (已有通用组件)
│   │   └── 列：名称、进货地、备注、创建时间、操作（查看详情 / 编辑 / 删除）
│   ├── OrderDialog（新增/编辑弹窗 — shadcn Dialog）
│   │   ├── TextField（name * — 新增时默认值=next-name 返回值）
│   │   ├── Select（purchasePlaceId — shadcn Select，预加载全部进货地）
│   │   └── TextArea（description）
│   └── DeleteAlertDialog
│
└── /orders/:id → OrderDetailPage (新增)
    ├── Header（← 返回列表 + 订单名称 + [编辑] [导出Excel] 按钮）
    ├── Info Bar（进货地 + 创建时间 + 备注）
    ├── [添加明细] 按钮
    ├── OrderDetailTable（自定义表格 — 不使用通用 DataTable）
    │   └── 列：分类 | 名称 | 数量 | 单位 | 单价 | 金额 | 备注 | 分类金额 | 总金额 | 操作
    │       ├── 按分类分组，分类列 + 分类金额列 合并单元格（rowSpan）
    │       ├── 总金额列跨全部行合并（rowSpan）
    │       ├── 金额标红：isModified === true → text-red-600 + 显示标准计算值
    │       └── 操作列：编辑 / 删除 按钮
    ├── ItemDialog（添加/编辑明细弹窗）
    │   ├── CommodityInput（搜索下拉：选已有商品自动带出分类+单位；输入无匹配文本=新商品名）
    │   ├── CategoryInput（搜索下拉：可搜索已有分类；输入无匹配文本=新分类名；已有商品带出时预填）
    │   ├── UnitInput（搜索下拉：可搜索已有单位；输入无匹配文本=新单位名；已有商品带出时预填）
    │   ├── NumberInput（quantity *）+ NumberInput（unitPrice *）
    │   ├── NumberInput（lineTotal * — quantity×unitPrice 自动计算默认值，手动改后标红并反向更新 unitPrice）
    │   └── TextArea（description）
    ├── DeleteItemAlertDialog
    ├── EditOrderDialog
    └── Excel Export（exceljs 前端生成）
```

**明细弹窗交互细节**：
1. 用户选商品 → 自动填分类+单位（从 commodity.category / commodity.unit 带出）
2. 用户无匹配商品（即输即建）→ 商品名=输入文本，分类/单位栏为空 → 用户可搜索已有或输入新建
3. 用户填 quantity + unitPrice → lineTotal 自动计算并填入
4. 用户手动改 lineTotal → 若与 quantity×unitPrice 不一致：①lineTotal 输入框标红 ②unitPrice = lineTotal/quantity 自动更新
5. 用户再次改 quantity → lineTotal 按 unitPrice×quantity 重新计算（恢复默认色）

## OrderDetailTable 组件设计

不使用通用 DataTable 组件。原因是：通用 DataTable 为每行独立渲染，不支持合并单元格（rowSpan），无法实现按分类分组的布局。

### 分组算法
1. 后端返回 items 已按 `category.name ASC, createdAt ASC` 排序
2. 前端 `groupItems()` 函数按 `commodity.category.id` 分组，计算每组 subtotal 和全局 grandTotal
3. 渲染时：每个 group 的第一个 item 行渲染「分类」和「分类金额」单元格（rowSpan = group.items.length），后续行不渲染
4. 首行渲染「总金额」单元格（rowSpan = 全部行数），后续行不渲染

### 标红逻辑
- `item.isModified === true` → 金额列 `text-red-600`，同时显示浅灰 `(computedLineTotal)` 参考值
- Excel 导出同理：标红行金额单元格红色字体 + 浅红背景

## Excel 导出

**方案**：前端使用 `exceljs` 库生成。

**导出内容**：
- 标题行：订单名称（合并、加粗 14pt）
- 信息行：进货地 + 创建时间
- 表头行：灰色背景 + 加粗 + 全部边框
- 数据行：合并单元格 + 分类小计 + 标红
- 总计行：加粗 + 双线上边框
- 文件名：`{订单名称}_{日期}.xlsx`

## 错误码

| 错误码 | HTTP | 场景 |
|--------|------|------|
| ORDER_EXISTS | 409 | 订单名称重复 |
| ORDER_HAS_ITEMS | 409 | 删除订单时存在未删除明细 |
| NOT_FOUND | 404 | 订单/明细/commodity/category/unit 不存在 |
| VALIDATION_ERROR | 422 | 参数校验失败 |

以上错误码已在 `packages/shared/src/constants/` 中定义，无需新增。

## 页面 UI 设计

### 订单详情页 (OrderDetailPage)

```
┌──────────────────────────────────────────────────────────────┐
│ ← 返回    订单名称                    [编辑] [导出 Excel]      │
│ 进货地: XXX - XXX    创建时间: 2026-08-03 14:30               │
├──────────────────────────────────────────────────────────────┤
│                                              [+ 添加明细]     │
├──────┬──────┬────┬────┬──────┬──────┬──────┬──────┬──────┬──┤
│ 分类 │ 名称 │数量│单位│ 单价  │ 金额  │ 备注 │分类金额│总金额│操作│
├──────┼──────┼────┼────┼──────┼──────┼──────┼──────┼──────┼──┤
│      │ 白菜 │ 2  │ kg │ 7.50 │15.00 │  -   │      │      │✏️🗑│  ← 标红行：手动改 lineTotal，
│ 蔬菜  │ 萝卜 │ 1  │ kg │ 8.00 │ 8.00 │  -   │23.00 │63.00 │✏️🗑│     单价反向=15/2=7.50
├──────┼──────┼────┼────┼──────┼──────┼──────┼──────┤      ├──┤
│ 肉类  │ 猪肉 │ 3  │ kg │15.00 │45.00 │  -   │40.00 │      │✏️🗑│
└──────┴──────┴────┴────┴──────┴──────┴──────┴──────┴──────┴──┘
```

### Visual Design Constants

| 元素 | Light | Dark |
|------|-------|------|
| Page 标题 | `text-[18px] font-bold text-[#0F172A]` | `text-white` |
| 表格边框 | `border border-[#E2E8F0] rounded-[6px]` | `border-[#334155]` |
| 表头 | `text-[11px] font-semibold text-[#64748B]` | `text-[#94A3B8]` |
| 标红金额 | `text-red-600 font-medium` | `text-red-400` |
| 标红参考值 | `text-[11px] text-red-400` | `text-red-500/70` |
| lineTotal 输入框标红 | `border-red-400 text-red-600` | `border-red-500 text-red-400` |
| 分类合并单元格 | `font-medium align-top` | — |
| 总金额单元格 | `font-bold text-[15px] align-top` | — |

## 数据流

```
创建明细（含即输即建）:
User Action → 前端自动计算 lineTotal / 手动修改 lineTotal 反向更新 unitPrice
           → authFetch → POST /api/orders/:orderId/items
           → Zod Validation (lineTotal 必填)
           → OrderService.addItem
              ├── 1. Category (findFirst or create)
              ├── 2. Unit (findFirst or create)
              ├── 3. Commodity (findFirst or create)
              └── 4. OrderItem (create — 失败不回滚1-3)
           → Response → 前端刷新订单详情

Excel Export:
OrderDetailPage (内存数据) → exceljs → Blob → download
```

authFetch 已实现 401 自动 refresh 重试（P1），页面层无需额外处理鉴权。
