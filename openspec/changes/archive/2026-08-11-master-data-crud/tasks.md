# Tasks: master-data-crud

## Task 1: Backend — Category 模块

- 创建 `apps/server/src/modules/category/category.module.ts`
- 创建 `apps/server/src/modules/category/category.service.ts`
  - `findAll(page, pageSize, keyword)` — ILIKE search on name + description，跳过 deletedAt 记录，按 updatedAt DESC；返回 `{ items, meta: { page, pageSize, total } }`
  - `findById(id)` — 单条查询
  - `create(dto)` — trim name，检查唯一性 → Prisma create
  - `update(id, dto)` — trim name，检查唯一性（排除自身）→ Prisma update
  - `delete(id)` — 检查未删除 Commodity 关联，有则 throw CATEGORY_IN_USE，否则 set deletedAt
  - 唯一冲突 → throw `{ success: false, error: { code: "CATEGORY_EXISTS", message, existingId: "clx..." } }`
- 创建 `apps/server/src/modules/category/category.controller.ts`
  - 全端点 `@UseGuards(JwtAuthGuard)`，Swagger 装饰器
  - POST/PATCH 使用 `packages/shared` 的 `categorySchema` 做 Zod 校验（用 `ZodValidationPipe`）
  - 成功返回 `{ success: true, data: ... }`，错误返回 `{ success: false, error: { code, message } }`
- 更新 `apps/server/src/app.module.ts`（引入 CategoryModule）

**Spec coverage**: Requirement "分类的维护"

## Task 2: Backend — Unit 模块

- 创建 `apps/server/src/modules/unit/` — 结构同 Category
- `findAll` / `findById` / `create` / `update` / `delete` — 逻辑对称
- 唯一性冲突 → UNIT_EXISTS (409) + existingId
- 删除关联检查 → UNIT_IN_USE (409)
- 更新 `app.module.ts`

**Spec coverage**: Requirement "单位的维护"

## Task 3: Backend — Commodity 模块

- 创建 `apps/server/src/modules/commodity/`
- `create(dto)` — 校验 categoryId/unitId 存在性，trim name，检查 name+unitId 唯一
- `findAll` — keyword 搜索联动 category.name + unit.name + commodity.name + description，Prisma include category + unit
- `delete` — 检查未删除 OrderItem 关联 → COMMODITY_IN_USE
- 复用 `packages/shared` 的 `commoditySchema`（已有 `z.string().min(1)` 校验 categoryId/unitId，不做 `cuid()` 限制）
- Service 层做 categoryId/unitId 存在性检查

**Spec coverage**: Requirement "商品的维护与关联约束"

## Task 4: Backend — PurchasePlace 模块

- 创建 `apps/server/src/modules/purchase-place/`
- `create(dto)` — trim place + marketName，检查组合唯一 → PURCHASE_PLACE_EXISTS + existingId
- `delete` — 检查未删除 Order 关联 → PURCHASE_PLACE_IN_USE
- 复用 `packages/shared` 的 `purchasePlaceSchema`

**Spec coverage**: Requirement "进货地的维护"

## Task 5: Backend — 共享基础设施

- 复用 `packages/shared` 中已有的 `paginationSchema`（无需新建 pagination.dto.ts）
- 创建通用 `ZodValidationPipe`（若尚未存在）：接收 Zod schema，自动 safeParse + 422 错误响应
- 创建通用异常处理 helper：捕获 Prisma P2002 unique constraint → 映射为 409 + existingId
- 删除关联检查与 `set deletedAt` 放在 **Prisma 事务** 中执行（消除 TOCTOU 竞态）
- Controller 统一响应格式：`{ success: true, data }` / `{ success: false, error: { code, message } }`
- 在 `main.ts` 中配置 SwaggerModule.setup("/api/docs", app, document)（项目已有 @nestjs/swagger 依赖）

**Spec coverage**: Requirements "分页与关键字搜索" + "默认排序"

## Task 6: Shared — 确认已有 Schema 可直接复用

- `packages/shared/src/validators/index.ts` 已包含 `paginationSchema`、`categorySchema`、`unitSchema`、`commoditySchema`、`purchasePlaceSchema`
- `packages/shared/src/constants/index.ts` 已包含所有 `ERROR_CODES` 和 `ERROR_MESSAGES`
- 确认 `packages/shared/src/index.ts` 已导出上述内容
- `pnpm --filter shared build` 确保编译通过

## Task 7: Frontend — shadcn/ui 组件补齐（P3 新依赖）

- 安装并初始化 sonner（toast 通知）：`pnpm --filter web add sonner`
- 创建 `apps/web/src/components/ui/dialog.tsx`（新增/编辑弹窗）
- 创建 `apps/web/src/components/ui/alert-dialog.tsx`（删除二次确认）
- 创建 `apps/web/src/components/ui/command.tsx`（CreatableSelect 依赖的 combobox）
- 创建 `apps/web/src/components/ui/table.tsx`（DataTable 基础）
- 创建 `apps/web/src/components/ui/select.tsx`（Commodity 页 category/unit 下拉）
- 以上组件使用 `npx shadcn@latest add <name>` 命令添加（已配置好的 shadcn）
- 在 AppShell（`apps/web/src/components/layout/AppShell.tsx`）中挂载 `<Toaster />` 组件

## Task 8: Frontend — 通用 DataTable 组件

- 创建 `apps/web/src/components/ui/data-table.tsx`
- Props:
  - `columns: { key: string; label: string; render?: (value: unknown, row: T) => ReactNode; width?: string }[]`
  - `data: T[]`
  - `loading?: boolean`
  - `pagination: { page: number; pageSize: number; total: number }`
  - `onPageChange: (page: number) => void`
- 使用 shadcn/ui Table
- 操作列固定右侧（如果 columns 中包含 `key: "actions"`，不显示表头文本）
- 空状态：「暂无数据」
- 分页使用简洁「< 1 2 3 >」样式，显示总数
- 暗色模式样式同步支持（参考 design.md Visual Design Constants dark 列）

## Task 9: Frontend — Category 管理页

- 创建 `apps/web/src/pages/Categories.tsx`
- 布局：PageHeader("商品分类") + SearchInput + [新增分类] 按钮 + DataTable
- 新增/编辑：shadcn Dialog，Form 含 name (Input) + description (Textarea)
- 删除：shadcn AlertDialog 二次确认「确定删除分类 "{name}"？如有商品关联将无法删除」
- API 调用使用 `authFetch`（已有）
- 搜索防抖 300ms
- 成功/失败 toast 反馈（sonner `toast.success` / `toast.error`）

## Task 10: Frontend — Unit 管理页

- 创建 `apps/web/src/pages/Units.tsx`
- 与 Category 页结构对称，字段相同（name + description）

## Task 11: Frontend — Commodity 管理页

- 创建 `apps/web/src/pages/Commodities.tsx`
- 列表列：名称、分类（`row.category.name`）、单位（`row.unit.name`）、备注、操作
- 弹窗表单：name (Input) + description (Textarea) + categoryId (shadcn Select) + unitId (shadcn Select)
- Category/Unit 下拉数据通过 `GET /api/categories?pageSize=1000` 和 `GET /api/units?pageSize=1000` 获取
  - 当前数据量有限，暂用大 pageSize；后续数据增长后改为专用 `/api/categories/all` 精简端点

## Task 12: Frontend — PurchasePlace 管理页

- 创建 `apps/web/src/pages/PurchasePlaces.tsx`
- 列表列：进货地(place)、市场名称(marketName)、备注、操作
- 弹窗表单：place (Input) + marketName (Input) + description (Textarea)

## Task 13: Frontend — CreatableSelect 即输即建组件

- 创建 `apps/web/src/components/ui/creatable-select.tsx`
- 基于 shadcn Command（combobox）+ Popover 实现
- 行为：
  1. 打开下拉时默认 fetch 前 20 条
  2. 输入时 debounce 300ms 后 fetch 搜索结果
  3. 搜索无精确匹配时列表顶行显示「使用当前输入：{userInput}」— `text-red-600 font-medium`
  4. 选择后调用 `createItem(name)` → 成功触发 `onChange(id)`
  5. 创建时后端返回 409 + `existingId` → 调用 `onChange(existingId)`，用户无感知
- 接口见 design.md CreatableSelect 组件设计
- **此组件在 P3 中仅定义和测试，实际业务集成在 P4 订单管理中完成**

## Task 14: Frontend — 路由注册

- 更新 `apps/web/src/App.tsx`，在 ProtectedRoute 内添加：
  - `/categories` → `<CategoriesPage />`
  - `/units` → `<UnitsPage />`
  - `/commodities` → `<CommoditiesPage />`
  - `/purchase-places` → `<PurchasePlacesPage />`
- 确保新页面在 AppShell 的 `<Outlet />` 中渲染

## Task 15: 构建 + 验证

- `vite build` 构建通过
- 后端 docker compose 重建 + migrate
- 验证清单:
  - [ ] `GET /api/categories` 返回分页列表（默认 20 条，按 updatedAt DESC）
  - [ ] `POST /api/categories { name: "蔬菜" }` 创建成功 → `{ success: true, data: {...} }`
  - [ ] `POST /api/categories { name: "蔬菜" }` 重复 → 409 `{ success: false, error: { code: "CATEGORY_EXISTS", existingId: "..." } }`
  - [ ] `DELETE /api/categories/:id` 有商品关联 → 409 CATEGORY_IN_USE
  - [ ] `DELETE /api/categories/:id` 无关联 → 200，`{ success: true, data: null }`，列表不再出现
  - [ ] Unit CRUD 同理（对称）
  - [ ] `POST /api/commodities` 无效 categoryId → 400
  - [ ] `POST /api/commodities` name+unitId 重复 → 409
  - [ ] `DELETE /api/commodities/:id` 有 OrderItem 关联 → 409
  - [ ] `POST /api/purchase-places` place+marketName 重复 → 409
  - [ ] `DELETE /api/purchase-places/:id` 有 Order 关联 → 409
  - [ ] keyword 搜索在所有 4 个列表生效（中英文、部分匹配）
  - [ ] 前端 4 个页面渲染完整，数据从 API 加载
  - [ ] 新增/编辑弹窗表单正常，校验生效（空名称不允许提交）
  - [ ] 删除二次确认弹窗正常，关联保护错误 toast 提示用户友好
  - [ ] 搜索 debounce 300ms 生效（快速输入不产生多次请求）
  - [ ] CreatableSelect 输入无匹配文本 → 显示「使用当前输入：xxx」→ 选择后调用 createItem 并回调 onChange
  - [ ] CreatableSelect 创建时后端返回 409 → 静默选中已有记录（existingId → onChange）
  - [ ] CreatableSelect 搜索 debounce 300ms 生效
  - [ ] Swagger 文档可访问（`/api/docs`），包含 4 个模块的端点
  - [ ] 暗色模式下表格、弹窗、按钮样式正常
  - [ ] 控制台无报错

## Task 16: 测试

- 后端 CategoryService 单元测试（create/update/delete/findAll 正常 + 异常路径）
- 后端 CategoryController E2E 测试（完整 CRUD 链路 + 409 响应格式校验 existingId）
- 后端 Unit/Commodity/PurchasePlace 各 1 个 E2E CRUD 完整链路测试
- 前端 CreatableSelect 组件测试（输入无匹配 → 选择即输即建 → onChange 触发；409 冲突 → 静默选中已有）
- 前端 Category 页面测试（渲染列表 + 弹窗表单交互）
