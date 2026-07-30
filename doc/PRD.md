<!--
  PRD 版本：v5.0-draft
  创建日期：2026-07-29
  状态：待审核
  范围：台帐系统 V3 全栈重构
-->

# 台帐系统 V3 全栈重构 — 产品需求文档

## 1. 项目概述

### 1.1 背景

台帐系统是一个面向个人的订单/对账管理工具，围绕"进货地 → 订单 → 明细"的核心链路，提供基础资料管理、订单录入、数据统计分析能力。系统经历两次迭代：

- **V1**：React 18 + Ant Design 5 + Webpack + Express + Mongoose + MongoDB + Redis（JWT 双令牌），前后端分离 + Nginx。
- **V2 / recon**（当前）：Next.js 16 App Router 全栈单体 + Prisma + PostgreSQL + Redis（iron-session）+ Arco Design + ECharts + ExcelJS，pnpm workspace。

**当前运行规模**：用户 2-3 人，日均订单不超过 10 条，历史数据量在千级。V3 的设计以此为基准——不引入分布式高并发方案，优先保持架构简洁和代码可读性。

V3 重构目标：拆分为前后端分离架构，后端 NestJS，前端 Vite + React + TypeScript + Tailwind CSS + shadcn/ui，完整保留 V2 功能并优化设计。

### 1.2 重构目标

| 目标 | 说明 |
|------|------|
| 技术栈升级 | 后端 NestJS（替代 Next.js Route Handlers）；前端 Vite SPA（替代 Next.js） |
| 架构分离 | 前后端独立构建部署，REST API 通信，Nginx 统一入口 |
| 学习练手 | NestJS 分层架构、Prisma 集成、JWT 鉴权、Redux Toolkit 状态管理 |
| 命名规范化 | 统一模型名、字段名、API 路径、DTO 命名，消除 V1/V2 历史不一致 |
| 文档沉淀 | 架构设计、API 文档（Swagger）、部署手册、开发指南 |
| UI 设计先行 | 先出 UI 稿审核，再进入开发 |

### 1.3 术语定义

| 术语 | 说明 |
|------|------|
| 台账 | 订单/对账记录 |
| 基础资料 | Category、Unit、Commodity、PurchasePlace 四类主数据 |
| 订单明细 | 订单下每条商品记录，模型名 OrderItem |
| 进货地 | 采购地点，由"place + marketName"组合唯一标识 |
| 软删除 | 通过 deletedAt 时间戳标记删除，保留审计信息 |

---

## 2. 命名规范

V3 对所有模型、字段、API 路径进行统一规范化。以下为 V2 → V3 的对照。

### 2.1 模型命名

| V2 现状 | V3 | 理由 |
|---------|-----|------|
| `OrderCommodity` | `OrderItem` | 通用惯例，更简洁 |
| `PurchasePlace` | `PurchasePlace` | 保持不变 |
| `Category` / `Unit` / `Commodity` / `Order` / `User` | 同左 | 已符合规范 |

### 2.2 字段命名

| V2 现状 | V3 | 理由 |
|---------|-----|------|
| `desc` | `description` | 全称更专业 |
| `count` | `quantity` | 语义精确（采购数量） |
| `price` | `unitPrice` | 明确表达"单价" |
| `lineTotal` | `lineTotal` | 保持，含义清晰 |
| `deleted` (Boolean) | `deletedAt` (DateTime?) | 保留删除时间用于审计 |
| `create_at` / `update_at` (DB column) | `createdAt` / `updatedAt` | camelCase 统一 |

### 2.3 API 路径

| V2 现状 | V3 | 理由 |
|---------|-----|------|
| `/api/order-lines` | `/api/orders/:orderId/items` | RESTful 嵌套，表达从属关系 |
| `/api/order-lines/:id` | `/api/orders/:orderId/items/:itemId` | 同上 |
| `/api/orders/:id/lines` | `/api/orders/:orderId/items`（GET） | 合并为统一资源路径 |
| `/api/auth/me` | `/api/auth/session` | 语义一致 |
| 其他 | 保持不变 | 已规范 |

---

## 3. 产品功能清单

### 3.1 功能全景

```
台帐系统 V3
│
├── 1. 用户认证
│   ├── 1.1 登录
│   ├── 1.2 登出
│   └── 1.3 Token 刷新
│
├── 2. 用户管理
│   └── 2.1 批量初始化用户（seed 脚本，支持 YAML 配置文件）
│
├── 3. 基础资料管理
│   ├── 3.1 分类管理（CRUD + 分页搜索 + 名称唯一 + 删除关联检查）
│   ├── 3.2 单位管理（CRUD + 分页搜索 + 名称唯一 + 删除关联检查）
│   ├── 3.3 商品管理（CRUD + 分页搜索 + 分类/单位关联 + 名称唯一 + 删除关联检查）
│   └── 3.4 进货地管理（CRUD + 分页搜索 + place+marketName 组合唯一 + 删除关联检查）
│
├── 4. 订单管理
│   ├── 4.1 订单列表（分页 + 搜索：名称/进货地/市场名/备注 + 删除确认）
│   ├── 4.2 订单创建（名称 + 进货地 + 备注，进货地下拉/自由输入自动创建）
│   ├── 4.3 订单编辑
│   ├── 4.4 订单删除（存在明细时拒绝）
│   └── 4.5 订单详情页
│       ├── 4.5.1 订单头信息
│       ├── 4.5.2 明细表格（按分类合并单元格）
│       ├── 4.5.3 明细新增（即输即建商品/分类/单位）
│       ├── 4.5.4 明细编辑（quantity + unitPrice + lineTotal 联动）
│       ├── 4.5.5 明细删除（二次确认）
│       ├── 4.5.6 分类小计 & 订单总计（合并单元格）
│       └── 4.5.7 导出 Excel（含合并单元格、格式、金额标红）
│
├── 5. 数据分析工作台（重构版）
│   ├── 5.1 KPI 卡片：订单总数、采购总额、商品种类、本月新增、环比变化率
│   ├── 5.2 月度采购趋势（近 12 月订单金额 & 数量双轴图）
│   ├── 5.3 分类金额占比（环形图）
│   ├── 5.4 进货地采购排行 Top 10（横向柱状图）
│   ├── 5.5 热购商品排行 Top 10（横向柱状图）
│   ├── 5.6 商品价格波动分析（选定商品近 12 月单价走势 + 均线）
│   └── 5.7 订单规模分布（按金额区间统计订单数，直方图）
│
└── 6. 通用能力
    ├── 6.1 统一 API 响应格式 + 中文错误提示
    ├── 6.2 Zod 参数校验（前后端共享 Schema）
    ├── 6.3 字段级表单校验 + 错误文本组件
    ├── 6.4 操作反馈（loading / 成功 / 失败）
    └── 6.5 删除确认弹窗（所有删除操作）
```

### 3.2 V1 → V2 → V3 功能对照

| 功能 | V1 | V2/recon | V3 |
|------|:---:|:---:|:---:|
| 用户登录 | ✅ JWT | ✅ iron-session | ✅ JWT 双令牌 |
| 用户批量初始化 | ❌ | ❌（仅 seed 单用户） | ✅ seed + YAML 配置 |
| 分类/单位 CRUD | ✅ | ✅ | ✅ |
| 商品 CRUD | ✅ | ✅ | ✅ |
| 进货地 CRUD | ❌ | ✅ | ✅ |
| 订单 + 明细 CRUD | ✅ | ✅ | ✅ |
| 即输即建主数据 | ❌ | ✅ | ✅ |
| quantity/unitPrice/lineTotal 联动 | 前端计算 | ✅ | ✅ |
| 分类小计 + 订单总计 | ✅ | ✅ | ✅ |
| 导出 Excel | ❌ | ✅ | ✅ |
| **工作台数据看板** | ❌ | ✅（旧版 5 图） | ✅ **重构版 7 模块** |
| 月度趋势双轴图 | ❌ | ❌ | ✅ **新增** |
| 环比变化率 | ❌ | ❌ | ✅ **新增** |
| 价格波动分析 | ❌ | ❌ | ✅ **新增** |
| 订单规模分布 | ❌ | ❌ | ✅ **新增** |
| API 文档 (Swagger) | ✅ | ❌ | ✅ NestJS Swagger |
| 单元测试 | ❌ | ✅ | ✅ |
| E2E 测试 | ❌ | ✅ | ✅ |
| UI 设计稿 | ❌ | ❌ | ✅ Pencil .pen + 导出 |

---

## 4. 技术架构

### 4.1 技术栈

| 层级 | V2 / recon | **V3** | 选型理由 |
|------|-----|---------|----------|
| 仓库管理 | pnpm workspace | pnpm workspace | 保持 |
| 前端框架 | React 19 (Next.js) | React 19+ (Vite SPA) | 前后端分离 |
| 前端构建 | Next.js | **Vite** | 更快，SPA 首选 |
| UI 组件 | Arco Design | **shadcn/ui** | Tailwind 原生集成、源码可控、视觉现代 |
| 图表 | ECharts | ECharts | 数据可视化首选；Three.js 在台账场景无应用价值 |
| 状态管理 | 组件内 state + fetch | **Redux Toolkit + RTK Query** | 学习 Redux 生态；RTK Query 管理 API 缓存 |
| 后端框架 | Next.js Route Handlers | **NestJS** | 分层架构、依赖注入、模块化 |
| ORM | Prisma 6 | Prisma 6 | 保持 |
| 数据库 | PostgreSQL 16 | PostgreSQL 16 | 保持 |
| 缓存/会话 | Redis (iron-session) | Redis（JWT 黑名单 + Refresh Token） | 适应前后端分离 |
| 鉴权 | iron-session Cookie | JWT Access + Refresh Token | 前后端分离标准方案 |
| 校验 | Zod | Zod + class-validator | NestJS 原生支持 |
| Excel 导出 | ExcelJS | ExcelJS | 保持 |
| API 文档 | 无 | NestJS Swagger | 装饰器自动生成 |
| 反向代理 | 无 | **Nginx** | 统一入口 |
| 容器化 | Docker Compose | Docker Compose | 保持 |
| 测试 | Vitest + Playwright | Vitest + Playwright + Jest | 补充后端测试 |
| 代码规范 | ESLint + Prettier | ESLint + Prettier | 保持 |

### 4.2 shadcn/ui + ECharts 选型分析

**为什么选 shadcn/ui 而非 Arco Design：**

- shadcn/ui 将组件源码复制到项目中，可自由修改，学习价值远高于黑盒封装组件库
- 基于 Radix UI 原语 + Tailwind CSS，与 V3 技术栈天然统一
- 视觉风格现代简约，适合数据密集型后台工具
- 体积小（按需引入），不产生冗余代码
- 对于台账系统需要的组件（Table、Dialog、Form、Select、Button、Card、Tabs、Dropdown），shadcn/ui 完全覆盖

**为什么选 ECharts 而非 Three.js：**

- ECharts 是数据图表库，专为仪表盘/报表设计；Three.js 是 3D 渲染引擎
- 台账系统的数据分析需求（趋势图、柱状图、饼图、环形图、直方图）全部属于 2D 图表范畴
- Three.js 需要手写 WebGL 场景，开发成本高，且在本系统中无 3D 场景应用价值
- ECharts 配置式 API 学习门槛低，与 React 集成成熟

### 4.3 系统架构图

```
┌─────────────────────────────────────────────────┐
│                    Nginx (:80)                   │
│  /api/*    → backend:3001                        │
│  /*        → frontend:5173 (dev) / static (prod) │
└──────────────┬──────────────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                      │
    ▼                      ▼
┌──────────────┐   ┌──────────────────┐
│  Frontend    │   │  Backend (NestJS)│
│  Vite + React│   │  :3001           │
│  :5173       │   │                  │
│              │   │  AuthModule      │
│  shadcn/ui   │──▶│  CategoryModule  │
│  ECharts     │   │  UnitModule      │
│  ExcelJS     │   │  CommodityModule │
│  Redux Toolkit│  │  PurchasePlaceM. │
│  RTK Query   │   │  OrderModule     │
│  React Router│   │  AnalyticsModule │
└──────────────┘   │  PrismaService   │
                   │  RedisService    │
                   └──────┬───────────┘
                          │
               ┌──────────┴──────────┐
               │                      │
               ▼                      ▼
        ┌────────────┐        ┌────────────┐
        │ PostgreSQL │        │   Redis    │
        │   :5432    │        │   :6379    │
        └────────────┘        └────────────┘
```

### 4.4 Nginx 配置要点

| 配置项 | 建议值 | 说明 |
|--------|--------|------|
| `proxy_pass /api/*` | `http://backend:3001` | API 代理到 NestJS |
| `proxy_pass /*` | `http://frontend:5173` (dev) / static files (prod) | SPA 静态资源 |
| `gzip` | on, level 6 | 压缩 JS/CSS |
| 静态资源缓存 | `*.js`, `*.css` max-age=31536000 | SPA 文件名含 hash，可长缓存 |
| `client_max_body_size` | 10m | 预留未来文件导入 |
| `proxy_read_timeout` | 60s | 分析接口允许较长时间 |

### 4.5 仓库结构

```
ledger-v3/
├── apps/
│   ├── web/                     # 前端 SPA（Vite + React + shadcn/ui）
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/          # shadcn/ui 组件（Button, Card, Dialog, Table...）
│   │   │   │   ├── form/        # 表单组件（FieldErrorText, RequiredLabel）
│   │   │   │   ├── analytics/   # ECharts 图表组件
│   │   │   │   └── layout/      # AppShell, SideNav, TopBar
│   │   │   ├── pages/           # 路由页面
│   │   │   ├── hooks/           # 自定义 Hooks
│   │   │   ├── store/           # Redux store + slices + RTK Query API
│   │   │   ├── lib/             # 工具函数
│   │   │   └── styles/          # Tailwind 全局样式
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── server/                  # 后端 API（NestJS + Prisma）
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── category/
│       │   │   ├── unit/
│       │   │   ├── commodity/
│       │   │   ├── purchase-place/
│       │   │   ├── order/
│       │   │   ├── analytics/
│       │   │   └── common/      # PrismaService, RedisService, AuthGuard
│       │   ├── filters/         # 异常过滤器
│       │   ├── interceptors/    # 响应格式拦截器
│       │   └── main.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   ├── seed.ts          # 种子数据（含批量用户初始化）
│       │   └── seed-users.yaml  # 批量用户配置文件
│       ├── test/
│       └── package.json
├── packages/
│   ├── shared/                  # 共享 DTO、类型、Zod Schema、错误码
│   │   └── src/
│   │       ├── types/           # ApiResult, PageData, SessionUser 等
│   │       ├── dto/             # 业务 DTO
│   │       ├── validators/      # Zod Schema
│   │       └── constants/       # 错误码、默认值
│   └── config/                  # 共享 ESLint / TSConfig / Prettier / Tailwind
├── design/                      # UI 设计稿
│   └── v3-ui.pen                # Pencil 设计文件
├── docker-compose.yml
├── nginx.conf
├── pnpm-workspace.yaml
├── package.json
└── docs/
    ├── architecture.md
    ├── api.md
    ├── deployment.md
    └── development.md
```

---

## 5. 数据模型

### 5.1 Prisma Schema（V3 规范化版）

```prisma
model User {
  id           String    @id @default(cuid())
  username     String    @unique
  passwordHash String
  role         String    @default("admin")  // 预留字段，当前不参与权限判断
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?
}

model Category {
  id          String      @id @default(cuid())
  name        String      @unique
  description String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  deletedAt   DateTime?
  commodities Commodity[]
}

model Unit {
  id          String      @id @default(cuid())
  name        String      @unique
  description String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  deletedAt   DateTime?
  commodities Commodity[]
}

model Commodity {
  id          String      @id @default(cuid())
  name        String
  description String?
  categoryId  String
  unitId      String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  deletedAt   DateTime?
  category    Category    @relation(fields: [categoryId], references: [id])
  unit        Unit        @relation(fields: [unitId], references: [id])
  orderItems  OrderItem[]

  @@unique([name, unitId])
}

model PurchasePlace {
  id          String    @id @default(cuid())
  place       String
  marketName  String
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  orders      Order[]

  @@unique([place, marketName])
}

model Order {
  id              String    @id @default(cuid())
  name            String
  description     String?
  purchasePlaceId String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?
  purchasePlace   PurchasePlace? @relation(fields: [purchasePlaceId], references: [id], onDelete: Restrict)
  items           OrderItem[]

  @@index([purchasePlaceId])
  @@unique([name, deletedAt])    // 仅未删除记录中 name 唯一
}

model OrderItem {
  id          String    @id @default(cuid())
  orderId     String
  commodityId String
  quantity    Decimal   @db.Decimal(12, 3)
  unitPrice   Decimal   @db.Decimal(12, 2)
  lineTotal   Decimal   @db.Decimal(12, 2)
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  order       Order     @relation(fields: [orderId], references: [id])
  commodity   Commodity @relation(fields: [commodityId], references: [id])
}
```

### 5.2 V1/V2 → V3 字段映射总表

| V1 Mongo | V2/recon Prisma | V3 Prisma | 说明 |
|----------|-----------------|-----------|------|
| `desc` | `desc` | `description` | 全称统一 |
| `count` | `count` | `quantity` | 语义精确化 |
| `price` | `price` | `unitPrice` | 明确为"单价" |
| 无 | `lineTotal` | `lineTotal` | 保持 |
| `deleted` (Boolean) | `deleted` (Boolean) | `deletedAt` (DateTime?) | 审计可追溯 |
| `create_at` | `createdAt` | `createdAt` | 保持 |
| `update_at` | `updatedAt` | `updatedAt` | 保持 |
| `order_commodity` | `OrderCommodity` | `OrderItem` | 业界惯例 |

---

## 6. API 设计

### 6.1 通用约定

**统一响应格式：**

```typescript
// 成功 - 单条
{ "success": true, "data": T }
// 成功 - 列表
{ "success": true, "data": { "items": T[], "meta": { "page": 1, "pageSize": 20, "total": 100 } } }
// 失败
{ "success": false, "error": { "code": "ERROR_CODE", "message": "中文描述" } }
```

**RESTful 嵌套原则：** 子资源路径挂在父资源下（如 `/api/orders/:orderId/items`）。

### 6.2 接口清单

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 认证 | POST | `/api/auth/login` | 登录，返回 accessToken + refreshToken |
| 认证 | POST | `/api/auth/logout` | 登出，Token 加入黑名单 |
| 认证 | POST | `/api/auth/refresh` | 刷新 accessToken |
| 认证 | GET | `/api/auth/session` | 获取当前用户信息 |
| 分类 | GET | `/api/categories` | 列表 |
| 分类 | POST | `/api/categories` | 新增 |
| 分类 | PUT | `/api/categories/:id` | 编辑 |
| 分类 | DELETE | `/api/categories/:id` | 删除（关联检查） |
| 单位 | GET | `/api/units` | 列表 |
| 单位 | POST | `/api/units` | 新增 |
| 单位 | PUT | `/api/units/:id` | 编辑 |
| 单位 | DELETE | `/api/units/:id` | 删除（关联检查） |
| 商品 | GET | `/api/commodities` | 列表 |
| 商品 | POST | `/api/commodities` | 新增 |
| 商品 | PUT | `/api/commodities/:id` | 编辑 |
| 商品 | DELETE | `/api/commodities/:id` | 删除（关联检查） |
| 进货地 | GET | `/api/purchase-places` | 列表 |
| 进货地 | POST | `/api/purchase-places` | 新增 |
| 进货地 | PUT | `/api/purchase-places/:id` | 编辑 |
| 进货地 | DELETE | `/api/purchase-places/:id` | 删除（关联检查） |
| 订单 | GET | `/api/orders` | 列表（分页+搜索） |
| 订单 | GET | `/api/orders/:orderId` | 详情（含 items + purchasePlace） |
| 订单 | POST | `/api/orders` | 新增 |
| 订单 | PATCH | `/api/orders/:orderId` | 编辑 |
| 订单 | DELETE | `/api/orders/:orderId` | 删除（明细检查） |
| 订单明细 | GET | `/api/orders/:orderId/items` | 明细列表 |
| 订单明细 | POST | `/api/orders/:orderId/items` | 新增明细（即输即建） |
| 订单明细 | PATCH | `/api/orders/:orderId/items/:itemId` | 编辑明细 |
| 订单明细 | DELETE | `/api/orders/:orderId/items/:itemId` | 删除明细 |
| 分析 | GET | `/api/analytics/workbench` | 工作台数据 |
| 分析 | GET | `/api/analytics/commodity` | 单品分析 |
| 系统 | GET | `/api/health` | 健康检查（DB + Redis 连通性） |

### 6.3 鉴权方案

V3 采用 JWT Access Token + Refresh Token：

- 登录返回 `accessToken`（15min）+ `refreshToken`（7d）
- Access Token 通过 `Authorization: Bearer <token>` Header 传递
- Refresh Token 存储在 httpOnly Cookie 中，同时在 Redis 维护映射
- 登出时 Access Token 的 `jti` 加入 Redis 黑名单（TTL = 剩余有效期）
- NestJS 通过 `JwtAuthGuard` 全局保护 `/api/*`（除 auth 路由和 `/api/health`）
- Refresh Token Cookie 设置 `SameSite=Strict` + `HttpOnly`，防止 CSRF

### 6.4 错误码

| 错误码 | 中文提示 | HTTP 状态码 |
|--------|----------|:---:|
| `INVALID_CREDENTIALS` | 用户名或密码错误 | 401 |
| `TOKEN_EXPIRED` | 登录已过期，请重新登录 | 401 |
| `TOKEN_REVOKED` | 令牌已失效 | 401 |
| `CATEGORY_EXISTS` | 分类名称已存在 | 409 |
| `UNIT_EXISTS` | 单位名称已存在 | 409 |
| `COMMODITY_EXISTS` | 商品名称已存在 | 409 |
| `PURCHASE_PLACE_EXISTS` | 进货地已存在 | 409 |
| `ORDER_EXISTS` | 订单名称已存在 | 409 |
| `CATEGORY_IN_USE` | 该分类已被商品引用，无法删除 | 409 |
| `UNIT_IN_USE` | 该单位已被商品引用，无法删除 | 409 |
| `COMMODITY_IN_USE` | 该商品已被订单引用，无法删除 | 409 |
| `PURCHASE_PLACE_IN_USE` | 该进货地已被订单引用，无法删除 | 409 |
| `ORDER_HAS_ITEMS` | 订单下存在明细，请先删除所有明细 | 409 |
| `VALIDATION_ERROR` | 请求参数不合法 | 422 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `INTERNAL_ERROR` | 服务器内部错误 | 500 |

---

## 7. 用户与权限

### 7.1 权限模型

系统用户 2-3 人，均为可信内部成员，不做细粒度 RBAC。所有登录用户拥有相同权限（读写全部资源），`role` 字段保留为字符串类型仅作扩展预留，实际不参与权限判断。

### 7.2 用户初始化

V3 不提供公开注册功能，通过以下两种方式创建用户：

#### 7.2.1 Seed 脚本批量导入

配置文件 `apps/server/prisma/seed-users.yaml`：

```yaml
users:
  - username: admin
    password: admin123
  - username: user2
    password: user2123
  - username: user3
    password: user3123
```

Seed 脚本读取此文件，对每个用户执行 upsert（以 username 为唯一键，更新密码，保留已有用户不删除）。

#### 7.2.2 CLI 手动创建

```bash
pnpm --filter server db:create-user --username xxx --password xxx --role admin
```

内部调用 Prisma upsert，与 seed 逻辑一致。

---

## 8. 工作台数据分析（重构版）

基于进销存/ERP 行业惯例重新设计统计维度，替代 V2 的现有方案。

### 8.1 KPI 概览卡片

| 指标 | 计算方式 | 辅助信息 |
|------|----------|----------|
| 采购总额 | 时间范围内所有 OrderItem.lineTotal 之和 | 环比上期 ↑/↓ 百分比 |
| 订单总数 | 时间范围内创建的非删除订单数 | 环比上期 ↑/↓ 百分比 |
| 商品种类 | 时间范围内出现过的不同 Commodity 数 | 本期新增种类 |
| 本月新增 | 本月创建的订单数 | 日均订单数 |

### 8.2 图表矩阵

| 序号 | 图表 | 类型 | 说明 |
|:---:|------|------|------|
| 1 | 月度采购趋势 | 柱状图 + 折线图（双 Y 轴） | 近 12 月订单金额（柱）+ 订单数量（折线），按月聚合 |
| 2 | 分类金额占比 | 环形图 (Donut) | 各 Category 采购金额占比，中心显示总金额 |
| 3 | 进货地采购排行 | 横向柱状图 | Top 10 进货地，按采购金额降序 |
| 4 | 热购商品排行 | 横向柱状图 | Top 10 商品，按采购金额降序 |
| 5 | 商品价格波动 | 折线图（含均线） | 选定商品近 12 月 unitPrice 走势 + 移动平均线 |
| 6 | 订单规模分布 | 直方图 (Histogram) | 按订单总金额分桶统计订单数量（如 0-1k, 1k-5k, 5k-10k, 10k-50k, 50k+） |

### 8.3 筛选控制

- 时间范围选择器（预设：近 1 月 / 近 3 月 / 近 6 月 / 近 12 月 / 自定义）
- 图 5 特定：商品下拉选择器
- 全局：进货地筛选（可选）

---

## 9. 前端状态管理

采用 Redux Toolkit + RTK Query：

- **RTK Query**：管理所有 API 请求（自动缓存、失效、乐观更新、loading/error 状态）
- **Redux Toolkit Slices**：管理认证状态（user、token）、UI 状态（sidebar 折叠等）
- 替代 V2 的组件内 `useState + fetch` 模式

```
store/
├── index.ts              # configureStore
├── api/
│   ├── baseApi.ts        # createApi（baseUrl、headers 注入、错误处理）
│   ├── authApi.ts        # login/logout/refresh/session
│   ├── categoryApi.ts    # categories CRUD
│   ├── unitApi.ts        # units CRUD
│   ├── commodityApi.ts   # commodities CRUD
│   ├── purchasePlaceApi.ts
│   ├── orderApi.ts       # orders CRUD
│   ├── orderItemApi.ts   # order items CRUD
│   └── analyticsApi.ts   # workbench + commodity analytics
└── slices/
    ├── authSlice.ts      # user, accessToken, isAuthenticated
    └── uiSlice.ts        # sidebarOpen, theme
```

---

## 10. UI 设计稿方案

### 10.1 工具链

| 阶段 | 工具 | 产出 |
|------|------|------|
| 概念稿 | `imagegen` 技能 | 各页面概念截图（快速对齐风格） |
| 详细设计 | Pencil MCP（.pen 文件） | 交互稿、组件标注、响应式约束 |
| 前端对接 | Pencil export HTML + Tailwind | 直接可用的 Tailwind 布局代码 |
| 评审确认 | Pencil export PNG | 审核用静态稿 |

### 10.2 设计流程

1. PRD 审核通过后，基于 PRD 第 6 节路由结构生成各页面 Pencil 设计
2. 导出 PNG 供评审
3. 修改直至确认
4. 导出 HTML+Tailwind，作为前端开发的布局起点

---

## 11. 实施计划

| 阶段 | 内容 | 产出 |
|------|------|------|
| **Phase 0：设计** | 基于 PRD 生成 Pencil UI 设计稿 → 评审修改 → 确认 | 完整 .pen 设计文件 + 导出稿 |
| **Phase 1：骨架** | pnpm workspace、NestJS 脚手架、Vite 脚手架、Docker Compose + Nginx、共享包、shadcn/ui 初始化 | 可启动空项目 |
| **Phase 2：基础设施** | Prisma Schema + Migration + Seed（含批量用户）、Redis、JWT 鉴权、响应拦截器、异常过滤器、Zod 校验、Swagger | 认证可用 |
| **Phase 3：基础资料** | Category / Unit / Commodity / PurchasePlace 四模块 + 前端 CRUD 页面 + RTK Query 集成 | 基础资料完整 |
| **Phase 4：订单** | Order + OrderItem 模块、订单列表/详情页、即输即建、lineTotal 联动、Excel 导出 | 订单完整 |
| **Phase 5：工作台** | Analytics 模块（KPI + 6 图 + 筛选 + 单品分析）、前端 ECharts 集成 | 数据看板可用 |
| **Phase 6：测试与文档** | 后端 Service 单元测试、前端组件测试、E2E 冒烟、架构/API/部署/开发文档 | 可交付 |

### 11.1 从 V2 可复用的纯逻辑

| 模块 | 文件 | 迁移方式 |
|------|------|----------|
| 合并单元格计算 | `line-aggregates.ts` | 直搬至 `packages/shared` |
| Excel 导出生成为 | `export-order-excel.ts` | 前端保持，或移至后端 |
| 分析计算引擎 | `analytics/workbench.ts` | 迁移至 NestJS AnalyticsService |
| 单品分析 | `analytics/commodity.ts` | 同上 |
| 删除守卫 | `delete-guards.ts` | 迁移至 NestJS Service |
| 错误码 | `delete-block-codes.ts` | 迁移至 `packages/shared/constants` |
| 即输即建逻辑 | `master-data/resolve-for-order-line.ts` | 迁移至 NestJS OrderService |
| lineTotal 计算 | `order-lines/line-total.ts` | 迁移至 `packages/shared` |

---

## 12. 非功能需求

| 维度 | 要求 |
|------|------|
| 性能 | 列表页首屏 ≤ 2s；工作台图表 ≤ 3s（千级数据量，本地环境） |
| 浏览器 | Chrome / Edge 最新两个版本（桌面端 ≥1280px） |
| 安全 | bcrypt 密码加密；JWT 15min 过期 + 黑名单登出；CORS 白名单；Helmet |
| 可维护性 | ESLint + Prettier；NestJS 模块化；TypeScript strict；命名规范见第 2 节 |
| 可测试性 | 后端 Service 单元测试覆盖率 ≥ 60%；核心流程 E2E 覆盖 |
| 容器化 | `docker compose up` 一条命令启动全部服务 |
| 文档 | README、架构设计、API 文档（Swagger）、部署手册、开发指南 |

---

## 13. 运维方案

### 13.1 数据备份

| 项目 | 方案 |
|------|------|
| PostgreSQL | 每日 `pg_dump` → 本地保留 7 天轮转；建议同步到云存储或另一台设备 |
| Redis | 不持久化（仅存 JWT 黑名单，重启丢失可接受） |
| Docker 卷 | `postgres-data` 卷映射到宿主机目录，随 pg_dump 一起备份 |
| 恢复验证 | 每季度用备份文件在新库做一次恢复演练 |

### 13.2 日志

- NestJS 使用内置 Logger，输出到 stdout
- Docker Compose 通过 `docker logs` 查看
- 错误日志包含请求路径、错误码、堆栈（非生产可保留，生产仅记录 code+message）

## 14. 风险与假设

### 14.1 规模与运行假设

| 维度 | 假设 | 影响 |
|------|------|------|
| 用户数 | 2-3 人，均为可信内部用户 | 不做 RBAC 细分；不做注册流程；不做限流 |
| 数据量 | 日均 ≤ 10 条订单，历史总量数千级 | 全量查询无性能压力；无需 Redis 缓存分析结果 |
| 并发 | 基本不存在同时编辑同一资源 | 采用 last-write-wins，不做乐观锁 |
| 设备 | 桌面端（≥1280px），Chrome / Edge | 不做移动端适配；不做多浏览器兼容矩阵 |
| 部署 | 单机 Docker Compose | 不做 K8s / 多副本 / 负载均衡 |

### 14.2 功能假设

- V3 为新建仓库，不从 V2 fork；代码参考 V2，git 历史独立
- 不迁移 V1 MongoDB 历史数据，仅从 V2 PostgreSQL 迁移（见第 15 节）
- 用户通过 seed 脚本或 CLI 创建，不提供 Web 注册页面
- 不做历史数据修改审计日志（数据量小，deletedAt 已提供基本追溯）

### 14.3 风险

| 风险 | 缓解 |
|------|------|
| NestJS + Prisma 集成缺乏经验 | Phase 2 投入充足时间，社区方案成熟 |
| shadcn/ui 组件不如 Arco 丰富 | 先评估缺哪些组件，必要时补充 Radix 原语 |
| 即输即建事务逻辑复杂 | 充分测试，保持与 V2 相同的事务边界 |
| ECharts + Vite SSR | ECharts 仅客户端渲染，动态 import 即可 |
| 工作台重构增加开发量 | 纯逻辑可从 V2 复用，仅图表配置重写 |

---


## 15. 数据迁移方案

### 15.1 迁移策略

采用 **导出→转换→导入** 三步策略：

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  V2 DB (source) │ ──▶ │ 迁移脚本 (transform) │ ──▶ │  V3 DB (target) │
│  PostgreSQL     │     │  TypeScript/Node  │     │  PostgreSQL     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

- V2 和 V3 使用**不同的数据库**（如 `recon` 和 `ledger_v3`），互不影响
- V3 先执行 Prisma migrate 建立空表结构，再运行迁移脚本填充数据
- V2 数据库全程只读，不修改原有数据
- 迁移脚本可重复执行（幂等），支持中断后重跑

### 15.2 数据转换映射

#### 15.2.1 模型名变更

| V2 表名 | V3 表名 | 处理方式 |
|---------|---------|----------|
| `Category` | `Category` | 直搬 |
| `Unit` | `Unit` | 直搬 |
| `Commodity` | `Commodity` | 直搬 |
| `PurchasePlace` | `PurchasePlace` | 直搬 |
| `Order` | `Order` | 直搬 |
| `User` | `User` | 直搬 |
| `OrderCommodity` | `OrderItem` | 重命名映射 |

#### 15.2.2 字段变更

| V2 字段 | V3 字段 | 转换逻辑 |
|---------|---------|----------|
| `desc` | `description` | 直接映射 |
| `count` | `quantity` | 直接映射 |
| `price` | `unitPrice` | 直接映射 |
| `lineTotal` | `lineTotal` | 直接映射 |
| `deleted` = false | `deletedAt` = null | 未删除 → null |
| `deleted` = true | `deletedAt` = `updatedAt` | 取 updatedAt 作为删除时间 |
| `createdAt` | `createdAt` | 保持 |
| `updatedAt` | `updatedAt` | 保持 |
| `id` (cuid) | `id` | 保持（V2 和 V3 都用 cuid，可直接复用） |
| 无 | `role` (User) | 默认设为 `"admin"` |

#### 15.2.3 关联字段

| V2 关联字段 | V3 关联字段 | 处理 |
|------------|------------|------|
| `OrderCommodity.orderId` | `OrderItem.orderId` | 直接映射（cuid 可跨库复用） |
| `OrderCommodity.commodityId` | `OrderItem.commodityId` | 同上 |
| `Order.purchasePlaceId` | `Order.purchasePlaceId` | 同上 |
| `Commodity.categoryId` | `Commodity.categoryId` | 同上 |
| `Commodity.unitId` | `Commodity.unitId` | 同上 |

关键前提：V2 和 V3 都使用 Prisma 的 `cuid()` 生成主键，且迁移脚本**原样保留 V2 的 id 值**，因此外键关联在迁移后自动保持正确。

#### 15.2.4 密码哈希兼容性

V2 和 V3 均使用 `bcryptjs` 加密密码。`passwordHash` 字段可直接迁移，V3 无需重新加密。

### 15.3 迁移脚本设计

脚本位置：`apps/server/prisma/migrate-from-v2.ts`

执行方式：

```bash
# 设置 V2 数据库连接串
export V2_DATABASE_URL="postgresql://recon:recon@localhost:5432/recon"

# 先建 V3 空表
pnpm --filter server prisma migrate deploy

# 再迁移数据
pnpm --filter server db:migrate-from-v2
```

迁移顺序：User → Category → Unit → PurchasePlace → Commodity → Order → OrderItem（先主数据后业务数据，确保外键引用的记录已存在）。

### 15.4 幂等性设计

迁移脚本每条记录用 `upsert`（以 `id` 为唯一键），可安全重复执行：已存在的记录覆盖更新，不存在的记录插入，不会产生重复数据。

### 15.5 迁移验证清单

| 检查项 | 验证方法 |
|--------|----------|
| 记录数一致 | 各表 `SELECT COUNT(*)` 对比 V2（排除 deleted=true）和 V3（排除 deletedAt IS NOT NULL） |
| 金额汇总一致 | SUM(lineTotal) 对比 |
| 外键完整性 | 检查所有 OrderItem.orderId / commodityId 在 V3 中存在 |
| 密码可登录 | 用 V2 用户密码在 V3 登录测试 |
| 删除记录标记 | 检查 V3 中 deletedAt 不为 null 的记录与 V2 中 deleted=true 的记录对应 |

### 15.6 迁移流程总览

```
1. docker compose up -d postgres redis      # 启动 V3 基础设施
2. 复制 .env.example → apps/server/.env      # 配置 V3 数据库
3. pnpm --filter server prisma migrate deploy # 建 V3 空表
4. pnpm --filter server prisma db seed       # 初始化 V3 用户（覆盖迁移脚本的用户）
5. 设置 V2_DATABASE_URL 环境变量
6. pnpm --filter server db:migrate-from-v2   # 执行数据迁移
7. 执行验证清单
8. 启动 V3 应用验证功能
```

### 15.7 回滚方案

迁移脚本只写 V3 库，不修改 V2 库。如需回滚：

```bash
# 清空 V3 数据库
pnpm --filter server prisma migrate reset --force
# 重新从步骤 3 执行
```

V2 系统在此期间可继续独立运行，不受影响。

## 16. 附录

### 16.1 参考资料

- V2/recon 代码库：`/Users/fanqw/Documents/Program/recon`
- recon 设计系统：`/Users/fanqw/Documents/Program/recon/DESIGN_SYSTEM.md`
- recon Pencil 设计指南：`/Users/fanqw/Documents/Program/recon/PENCIL_DESIGN_SPEC.md`
- shadcn/ui：https://ui.shadcn.com
- ECharts：https://echarts.apache.org
- NestJS：https://docs.nestjs.com

### 16.2 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-29 | 初版，基于 ledger-v2 |
| v2.0 | 2026-07-29 | 基于 recon 最新代码重写 |
| v3.0 | 2026-07-29 | 整合 7 项需求澄清：命名规范化、用户初始化、工作台重构、UI 组件选型分析、Redux 生态、UI 设计稿方案 |
| v4.0 | 2026-07-29 | 新增数据迁移方案（导出→转换→导入 三步策略、字段映射、幂等脚本、验证清单、回滚方案） |
| v5.0 | 2026-07-29 | 基于实际规模（2-3 人 / 日订单 <10）精简设计：去除过度设计项；新增运维方案（备份/日志）、权限简化、Nginx 配置要点、健康检查端点、SameSite CSRF 防护 |（导出→转换→导入 三步策略、字段映射、幂等脚本、验证清单、回滚方案） |澄清：命名规范化、用户初始化、工作台重构、UI 组件选型分析、Redux 生态、UI 设计稿方案 |
