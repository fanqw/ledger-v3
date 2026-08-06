# Tasks: sales-orders

## Task 1: Shared — Schema 扩充

- 修改 `packages/shared/src/validators/index.ts`
  - 新增 `orderCreateSchema`：name max(100)、purchasePlaceId 复用 idSchema
  - 新增 `orderUpdateSchema`：orderCreateSchema.partial()
  - 新增 `orderItemCreateSchema`：
    - `lineTotal` 改为**必填**（`z.number().nonnegative()`，不 `.optional()`）
    - `.refine()` 校验 commodityId 或 commodityName 至少提供一个
    - 移除第二条 refine（即输即建时不再强制要求 unit/category 必须提供）
  - 新增 `orderItemUpdateSchema`：quantity/unitPrice/lineTotal/description 均可选
  - 保留已有 `orderSchema`、`orderItemSchema` 作为向后兼容别名
  - 导出新类型：OrderCreateInput、OrderUpdateInput、OrderItemCreateInput、OrderItemUpdateInput
- 确认 `packages/shared/src/constants/index.ts` 已有错误码无需新增
- `pnpm --filter shared build` 确保编译通过

**Spec coverage**: Requirement "Zod 参数校验"

## Task 2: Backend — OrderService（TDD）

- 创建 `apps/server/src/modules/order/__tests__/order.service.spec.ts`
  - 参照 `commodity.service.spec.ts` 的 mock 模式，`jest.resetAllMocks()` 在 beforeEach
  - 至少 22 个测试用例：

**Order CRUD 测试（12 个）**：
1. `findAll` 分页搜索（keyword → where.OR）
2. `findAll` 无 keyword（where 仅含 deletedAt: null）
3. `getNextName` 当天无订单 → 返回 `YYYYMMDD-01`
4. `getNextName` 当天已有 1 条 → 返回 `YYYYMMDD-02`
5. `findById` 未找到 → NotFoundException
6. `findById` 返回含 purchasePlace + items 的详情
7. `create` 名称重复 → ConflictException + ORDER_EXISTS
8. `create` 进货地不存在 → BadRequestException
9. `create` 成功（trim name + FK 检查通过）
10. `update` 名称重复排除自身 → ConflictException
11. `update` 成功（包含 purchasePlace connect）
12. `delete` 成功（无未删除明细）→ deletedAt 写入
13. `delete` 有未删除明细 → ConflictException + ORDER_HAS_ITEMS

**OrderItem CRUD 测试（9 个）**：
14. `addItem` 引用已有商品 → lineTotal 按提交值原样持久化（必填，前端已算好）
15. `addItem` 订单不存在 → NotFoundException
16. `addItem` 商品不存在 → NotFoundException
17. `addItem` 即输即建（全新 category+unit+commodity）→ **不回滚**：逐个创建，任一步骤失败终止，OrderItem 失败时保留已创建的基础数据
18. `addItem` 即输即建复用已有分类和单位 → findFirst 命中，不重复创建
19. `addItem` 即输即建中 category 创建失败 → 终止，不创建 unit/commodity/orderItem
20. `updateItem` 提供 lineTotal → 原样持久化
21. `updateItem` 未提供 lineTotal → 根据 quantity×unitPrice 重新计算
22. `updateItem` 明细不存在 → NotFoundException
23. `deleteItem` → 软删除成功

**Spec coverage**: Requirements "订单的维护" + "订单明细的维护与关联" + "即输即建主数据" + "lineTotal 标红判定"

## Task 3: Backend — OrderService 实现

- 创建 `apps/server/src/modules/order/order.service.ts`
  - 注入 `PrismaService`，使用 NestJS Logger
  - **Order CRUD**：
    - `getNextName()` — 统计当天未删除订单数 count → 返回 `{ name: "YYYYMMDD-XX" }`（序号=count+1，补零 2 位）
    - `findAll(page, pageSize, keyword?)` — 同上
    - `findById(id)` — 同上（Decimal→Number + isModified/computedLineTotal）
    - `create(data)` — 同上
    - `update(id, data)` — 同上
    - `delete(id)` — 同上
  - **OrderItem CRUD（关键变更）**：
    - `addItem(orderId, data)` — **不使用单一 $transaction 包裹全部步骤**：
      - 校验订单存在
      - Path A（commodityId）：校验 commodity 存在 → create orderItem（lineTotal 按提交值原样持久化）
      - Path B（即输即建 commodityName）：
        1. 创建/查找 Category：categoryId 存在则校验，否则按 categoryName findFirst or create。失败 → 终止
        2. 创建/查找 Unit：同上。失败 → 终止
        3. 创建/查找 Commodity：按 name+unitId findFirst or create。失败 → 终止
        4. 创建 OrderItem：关联 commodityId。失败 → **不回滚** 1-3 中已创建的基础数据，返回错误
    - `updateItem(orderId, itemId, data)` — 同上（lineTotal 提供则原样，否则重算）
    - `deleteItem(orderId, itemId)` — 同上
  - lineTotal 校验：创建时必填（Schema 已约束），后端按提交值存储，不再服务端计算默认 lineTotal
  - Decimal 处理：输入时直接传 number（Prisma 自动转换），响应时 `Number(decimal)` 转换

**Spec coverage**: Requirements "订单的维护" + "订单明细的维护与关联" + "即输即建主数据"

## Task 4: Backend — OrderController + OrderModule

- 创建 `apps/server/src/modules/order/order.controller.ts`
  - 类级：`@ApiTags('Orders')`, `@ApiBearerAuth()`, `@UseGuards(JwtAuthGuard)`, `@Controller('orders')`
  - 新增端点：`GET /next-name` → `service.getNextName()`
  - 订单端点：GET `/`、GET `/:id`、POST `/`、PATCH `/:id`、DELETE `/:id`
  - 明细端点：POST `/:orderId/items`、PATCH `/:orderId/items/:itemId`、DELETE `/:orderId/items/:itemId`
  - 所有输入通过 `new ZodValidationPipe(schema)` 校验
  - `@HttpCode(200)` 在 DELETE 上
- 创建 `apps/server/src/modules/order/order.module.ts`
- 修改 `apps/server/src/app.module.ts` — imports 中添加 OrderModule
- 修改 `apps/server/src/app.module.spec.ts` — 添加 OrderModule 断言

**Spec coverage**: Requirement "统一的 API 响应格式"

## Task 5: Frontend — 订单列表页

- 创建 `apps/web/src/pages/Orders.tsx`
  - 复用 Commodities 页面模式
  - **新增弹窗**：
    - 打开时先调用 `GET /api/orders/next-name` 获取默认名称，填入 name 字段
    - name（必填，默认值预填，可手动修改）、purchasePlaceId（Select，预加载全部进货地）、description（Textarea）
  - DataTable 列：订单名称、进货地、备注、创建时间、操作（查看详情/编辑/删除）
  - 详情导航：`useNavigate()` → `/orders/${row.id}`
- 更新 `apps/web/src/App.tsx`
  - 新增 lazy import：`OrdersPage`、`OrderDetailPage`
  - 替换占位 orders 路由

**Spec coverage**: Requirements "订单的维护" + "操作反馈"

## Task 6: Frontend — 订单详情页（明细表格 + lineTotal 双向联动）

- 创建 `apps/web/src/pages/OrderDetail.tsx`

### 明细弹窗（添加/编辑）——核心交互

商品选择：统一的下拉搜索框（不使用 RadioToggle 分离模式）
- 搜索已有商品 → 选中后**自动带出**关联的分类（category.name）和单位（unit.name）
- 输入无匹配文本 → 输入值 = 新商品名称，分类/单位栏留空

分类字段（搜索下拉）：
- 商品带出时自动填入
- 用户可搜索选择已有分类
- 输入无匹配文本 → 输入值 = 新分类名称

单位字段（搜索下拉）：同分类逻辑

**lineTotal 双向联动**：
- 用户填 quantity 或 unitPrice → lineTotal 自动计算默认值并填入
- 用户手动修改 lineTotal →
  - 若 |lineTotal − quantity×unitPrice| > 0.005：
    1. lineTotal 输入框字体变红（text-red-600）
    2. unitPrice = lineTotal / quantity 自动计算并更新
  - 若与计算值一致 → 清除标红状态
- 用户修改 quantity **或 unitPrice** → lineTotal 按 quantity×unitPrice 重新计算，**清除标红状态**（恢复到默认联动）
- 提交时 lineTotal 必填

### 表单校验
- quantity > 0、unitPrice >= 0、lineTotal >= 0
- 商品名称 trim 后非空（即输即建时）

### 明细表格
- 自定义表格（使用 shadcn Table），支持分类分组 + 合并单元格（rowSpan）
- 分类列 + 分类金额列按 group 合并
- 总金额列跨全部行合并
- isModified === true → 金额列 `text-red-600` + 显示灰色参考值
- 操作列：编辑/删除按钮

**Spec coverage**: Requirements "订单详情页表格展示" + "lineTotal 标红判定" + "即输即建主数据"

## Task 7: Frontend — 明细 CRUD 弹窗（含即输即建）

在 `OrderDetail.tsx` 中实现（延续 Task 6 的弹窗逻辑）：

### 添加明细
1. 商品/分类/单位下拉框默认加载前 100 条，搜索时返回前 100 条结果，滚动到底自动加载下一页（每页 100 条）
2. 用户选商品 → 带出分类+单位
3. 用户填 quantity、unitPrice → lineTotal 自动填入
4. 用户可手动改 lineTotal → 标红 + 反向更新 unitPrice
5. 提交 `POST /api/orders/:orderId/items`：
   - commodityId 路径：`{ commodityId, quantity, unitPrice, lineTotal, description? }`
   - 即输即建路径：`{ commodityName, categoryId?/categoryName?, unitId?/unitName?, quantity, unitPrice, lineTotal, description? }`
   - 若基础数据创建失败（422/其他）→ toast 错误，保留弹窗，用户可修改后重试
   - 若 OrderItem 创建失败 → toast 错误，基础数据已创建成功（用户下次可搜索到）

### 编辑明细
- 预填 quantity、unitPrice、lineTotal、description
- 商品不可更改
- lineTotal 双向联动逻辑同上
- 调用 PATCH

### 删除明细
- AlertDialog 二次确认 → DELETE

### 编辑订单弹窗
- 复用 Orders 页面的弹窗模式 → PATCH

### Toast + 自动刷新
- 操作后 `fetchOrder()` 刷新详情

**Spec coverage**: Requirements "订单明细的维护与关联" + "即输即建主数据" + "操作反馈"

## Task 8: Frontend — Excel 导出

- 安装 `exceljs` 依赖：`pnpm add exceljs --filter web`
- 在 `OrderDetail.tsx` 中实现 `exportToExcel(order)` 函数：
  - 标题行（合并、加粗）、信息行、表头行（灰色背景+加粗+边框）
  - 数据行：按分组渲染，合并分类列/分类金额列/总金额列
  - 标红行：红色字体 + 浅红背景
  - 总计行：加粗 + 双线上边框
  - 文件名：`{订单名称}_{日期}.xlsx`
- "导出 Excel" 按钮调用该函数（数据来自已加载的 order 对象，无需额外 API）

**Spec coverage**: Requirement "Excel 导出"

## Task 9: Build + Lint + Test

- `pnpm build` 全量构建通过（shared + server + web）
- `pnpm --filter server lint` 无 ESLint 错误
- `pnpm --filter server test` 全量测试通过（除已有的 app.controller.spec.ts Redis mock 问题）
- `pnpm --filter server test -- --testPathPattern="order"` — 23 个 order 测试全过
- 验证清单：
  - [ ] `GET /api/orders/next-name` 返回默认名称（当天无订单 → `YYYYMMDD-01`）
  - [ ] `POST /api/orders { name }` 创建 → 列表包含
  - [ ] `POST /api/orders { name }` 重复 → 409 ORDER_EXISTS
  - [ ] `GET /api/orders?keyword=测试` 搜索生效
  - [ ] `DELETE /api/orders/:id` 有明细 → 409 / 无明细 → 200
  - [ ] `POST /api/orders/:orderId/items { commodityId, quantity, unitPrice, lineTotal }` → 创建成功
  - [ ] `POST /api/orders/:orderId/items { commodityName, categoryName, unitName, ... }` 即输即建成功
  - [ ] 即输即建时 OrderItem 创建失败 → category/unit/commodity 已保留（不回滚）
  - [ ] 即输即建时 category 创建失败 → 终止，不创建后续数据
  - [ ] 前端新增订单弹窗自动填入默认名称
  - [ ] 前端明细弹窗：选商品自动带出分类+单位
  - [ ] 前端明细弹窗：手动改 lineTotal → 标红 + unitPrice 反向更新
  - [ ] 前端明细弹窗：再改 quantity → lineTotal 恢复默认计算（清除标红）
  - [ ] 前端详情表格：分类分组 + 合并单元格 + 标红 + 小计
  - [ ] Excel 导出完整（合并单元格、标红、总计行）
  - [ ] Swagger `/api/docs` 包含 Orders 端点
  - [ ] 暗色模式样式正常
