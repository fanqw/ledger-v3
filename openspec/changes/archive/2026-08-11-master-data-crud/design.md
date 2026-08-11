# Design: master-data-crud

## API 设计

### 通用约定
- 所有端点需 JWT 鉴权（`@UseGuards(JwtAuthGuard)`）
- 成功响应格式：`{ success: true, data: T }`
- 列表响应格式：`{ success: true, data: { items: T[], meta: { page, pageSize, total } } }`
- 失败响应格式：`{ success: false, error: { code: string, message: string } }`
- **409 唯一冲突响应附加 `existingId`**：`{ success: false, error: { code: "CATEGORY_EXISTS", message: "...", existingId: "clx..." } }`，供前端 CreatableSelect 静默选中已有记录
- 错误码统一使用 `packages/shared/src/constants/` 中已定义的枚举（`ERROR_CODES`、`ERROR_MESSAGES`）
- 后端和前端共用 `packages/shared/src/validators/` 中的 Zod Schema（`paginationSchema`、`categorySchema`、`unitSchema`、`commoditySchema`、`purchasePlaceSchema` 已存在，直接复用）
- DELETE 成功返回 `{ success: true, data: null }`（HTTP 200，非 204，保持统一 JSON 响应体）
- 软删除：设置 `deletedAt`，列表默认过滤 `deletedAt: null`

### Category

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | 分页列表 `?page=1&pageSize=20&keyword=` |
| POST | `/api/categories` | 创建 `{ name, description? }` |
| GET | `/api/categories/:id` | 获取单个 |
| PATCH | `/api/categories/:id` | 更新 `{ name?, description? }` |
| DELETE | `/api/categories/:id` | 软删除（关联检查） |

### Unit

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/units` | 分页列表 |
| POST | `/api/units` | 创建 |
| GET | `/api/units/:id` | 获取单个 |
| PATCH | `/api/units/:id` | 更新 |
| DELETE | `/api/units/:id` | 软删除（关联检查） |

### Commodity

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/commodities` | 分页列表，联查 category.name + unit.name |
| POST | `/api/commodities` | 创建 `{ name, description?, categoryId, unitId }` |
| GET | `/api/commodities/:id` | 获取单个（含关联） |
| PATCH | `/api/commodities/:id` | 更新 |
| DELETE | `/api/commodities/:id` | 软删除（关联检查：OrderItem） |

### PurchasePlace

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/purchase-places` | 分页列表 |
| POST | `/api/purchase-places` | 创建 `{ place, marketName, description? }` |
| GET | `/api/purchase-places/:id` | 获取单个 |
| PATCH | `/api/purchase-places/:id` | 更新 |
| DELETE | `/api/purchase-places/:id` | 软删除（关联检查：Order） |

### 即输即建端点（Category / Unit / Commodity 通用）

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` + `?keyword=xxx&limit=10` | 下拉搜索 |
| POST | `/api/categories` | 创建新记录并返回 `{ success: true, data: { id, name } }` |

> 即输即建逻辑由前端 `CreatableSelect` 组件驱动：用户输入文本 → 调用搜索 API → 无精确匹配 → 显示「使用当前输入：{用户输入原文字}」→ 用户选择后调用创建 POST → 获取 id。

## 数据库 Schema

已存在于 Prisma schema（见 `apps/server/prisma/schema.prisma`），无需变更：

- Category: id, name(unique), description?, createdAt, updatedAt, deletedAt?
- Unit: id, name(unique), description?, createdAt, updatedAt, deletedAt?
- Commodity: id, name, description?, categoryId(FK), unitId(FK), createdAt, updatedAt, deletedAt? — @@unique([name, unitId])
- PurchasePlace: id, place, marketName, description?, createdAt, updatedAt, deletedAt? — @@unique([place, marketName])

## 前端组件树

```
AppShell (已有)
├── /categories → CategoriesPage
│   ├── PageHeader ("商品分类" + 新增按钮)
│   ├── SearchInput（防抖 300ms）
│   ├── DataTable (通用组件)
│   └── CategoryDialog（新增/编辑弹窗 — shadcn Dialog）
├── /units → UnitsPage（同上结构）
├── /commodities → CommoditiesPage
│   ├── PageHeader + SearchInput + DataTable
│   └── CommodityDialog
│       ├── TextField（name）
│       ├── TextArea（description）
│       ├── Select（categoryId — shadcn Select，非即输即建）
│       └── Select（unitId — shadcn Select，非即输即建）
└── /purchase-places → PurchasePlacesPage
    ├── PageHeader + SearchInput + DataTable
    └── PurchasePlaceDialog
        ├── TextField（place）
        ├── TextField（marketName）
        └── TextArea（description）
```

## CreatableSelect 组件设计

即输即建组件是 P3 的核心基础设施，供所有主数据关联下拉使用。

### 组件接口
```tsx
interface CreatableSelectProps {
  value: string | null;             // 当前选中 id
  onChange: (id: string) => void;   // 选中回调
  fetchItems: (keyword: string) => Promise<{ id: string; name: string }[]>;
  createItem: (name: string) => Promise<{ id: string; name: string }>;
  placeholder?: string;
}
```

### 行为
1. 打开下拉时默认显示前 20 条记录
2. 输入文本时 debounce 300ms 后调用 `fetchItems`
3. 列表顶行始终显示「使用当前输入：{用户输入原文字}」，选择时调用 `createItem`
4. 创建成功后自动选中新记录并触发 `onChange`
5. 若创建时后端返回 409 + `existingId` → 静默选中已有记录，无需用户干预
6. 基于 shadcn Command（combobox）实现

### 与普通 Select 的区别
- 商品管理的 category/unit 选择器使用普通 shadcn Select（不需要即输即建，分类和单位在各自管理页维护）
- 订单管理（P4）的 commodity 选择器使用 CreatableSelect（允许即输即建新商品）—— 属 P4 范围

> **用户明确要求**：订单创建时进货地不需要即输即建，只能下拉选（进货地有两个字段 place + marketName，无法通过单一文本输入完整创建）。

## 页面 UI 设计

所有 4 个页面采用统一布局模式（参考 Pencil UI 设计风格）：

```
┌──────────────────────────────────────────────┐
│ PageHeader                                    │
│ [🔍 Search Input...]           [+ 新增分类]   │
├──────────────────────────────────────────────┤
│ DataTable                                     │
│ ┌────┬────────────────┬──────────┬────────┐  │
│ │ #  │ 名称           │ 备注     │ 操作   │  │
│ ├────┼────────────────┼──────────┼────────┤  │
│ │ 1  │ 蔬菜           │ ...      │ 编 删  │  │
│ └────┴────────────────┴──────────┴────────┘  │
│                  [< 1 2 3 >]                   │
└──────────────────────────────────────────────┘
```

### Visual Design Constants

| 元素 | Light | Dark |
|------|-------|------|
| Page 标题 | `text-[18px] font-bold text-[#0F172A]` | `text-white` |
| 搜索框 | `w-[320px]` placeholder="搜索..." | — |
| 表格边框 | `border border-[#E2E8F0] rounded-[6px]` | `border-[#334155]` |
| 表头 | `text-[11px] font-semibold text-[#64748B] uppercase bg-[#F8FAFC]` | `bg-[#1E293B] text-[#94A3B8]` |
| 单元格 | `text-[13px] text-[#334155]` | `text-[#CBD5E1]` |
| 新增按钮 | shadcn Button `variant="default"` bg `#3B82F6` | — |
| 编辑按钮 | shadcn Button `variant="ghost"` size `icon` | — |
| 删除按钮 | shadcn Button `variant="ghost"` size `icon` + AlertDialog 二次确认 | — |
| 弹窗宽度 | `max-w-[480px]` | — |
| 空状态 | 居中 "暂无数据" `text-[#94A3B8] text-[13px]` | — |
| 加载状态 | 表格区域 Skeleton 或 Spinner | — |

## 错误码

| 错误码 | HTTP | 场景 |
|--------|------|------|
| CATEGORY_EXISTS | 409 | 名称重复 |
| UNIT_EXISTS | 409 | 名称重复 |
| COMMODITY_EXISTS | 409 | name+unitId 组合重复 |
| PURCHASE_PLACE_EXISTS | 409 | place+marketName 组合重复 |
| CATEGORY_IN_USE | 409 | 删除时存在未删除商品关联 |
| UNIT_IN_USE | 409 | 删除时存在未删除商品关联 |
| COMMODITY_IN_USE | 409 | 删除时存在未删除订单明细关联 |
| PURCHASE_PLACE_IN_USE | 409 | 删除时存在未删除订单关联 |

以上错误码已在 `packages/shared/src/constants/` 中定义，后端直接引用。

## 数据流

```
User Action → Page Component → authFetch → NestJS API
                                              ↓
                                         Zod Validation (Pipe)
                                              ↓
                                         Service Layer
                                              ↓
                                         Prisma ↔ PostgreSQL
                                              ↓
                                         Response → authFetch → Page State Update
```

authFetch 已实现 401 自动 refresh 重试（P1），页面层无需额外处理鉴权。
