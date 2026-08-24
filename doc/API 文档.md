# API 文档

## 概览

- **Base URL**：`http://localhost:3001/api`（本地）或 `http://localhost/api`（Docker）
- **交互式文档**：Swagger UI → `/api/docs`
- **鉴权**：除 `/api/auth/login`、`/api/health` 外，所有接口需 `Authorization: Bearer <accessToken>`
- **响应格式**：成功 `{ success: true, data }`，失败 `{ success: false, error: { code, message } }`
- **分页**：列表返回 `{ items, meta: { page, pageSize, total } }`
- **校验失败**：HTTP 422，错误码 `VALIDATION_ERROR`
- **未认证**：HTTP 401

## 错误码

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `VALIDATION_ERROR` | 422 | 参数校验失败 |
| `UNAUTHORIZED` | 401 | 未认证/Token 失效 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 唯一冲突（分类名/商品名/订单名等） |
| `ORDER_EXISTS` | 409 | 订单名已存在 |
| `ORDER_HAS_ITEMS` | 409 | 订单仍有明细，无法删除 |

## 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 登录，返回 accessToken，设置 refreshToken Cookie |
| POST | `/auth/logout` | 登出（撤销 Token） |
| GET | `/auth/session` | 获取当前会话用户 |
| POST | `/auth/refresh` | 刷新 Access Token |
| GET | `/auth/refresh-status` | 检查刷新状态 |

**登录请求**
```json
{ "username": "admin", "password": "admin123" }
```

## 基础资料

### 分类 `/categories`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/categories?page&pageSize&keyword` | 分页列表（名称搜索） |
| GET | `/categories/:id` | 详情 |
| POST | `/categories` | 创建 `{ name, description? }` |
| PATCH | `/categories/:id` | 更新 |
| DELETE | `/categories/:id` | 软删除 |

### 单位 `/units`、商品 `/commodities`、进货地 `/purchase-places`

同分类结构。商品创建需 `{ name, categoryId, unitId }`（分类/单位必填）。

## 订单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/orders/next-name` | 获取默认订单名（YYYYMMDD-序号） |
| GET | `/orders?page&pageSize&keyword` | 分页列表（名称/进货地/备注搜索） |
| GET | `/orders/:id` | 详情（含明细，按分类分组） |
| POST | `/orders` | 创建 `{ name, purchasePlaceId?, description? }` |
| PATCH | `/orders/:id` | 更新 |
| DELETE | `/orders/:id` | 软删除（有明细时返回 ORDER_HAS_ITEMS） |

### 订单明细

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/orders/:orderId/items` | 添加明细（引用商品 或 即输即建） |
| PATCH | `/orders/:orderId/items/:itemId` | 更新明细 |
| DELETE | `/orders/:orderId/items/:itemId` | 软删除明细 |

**添加明细**（两种方式）：
- 引用已有商品：`{ commodityId, quantity, unitPrice, lineTotal }`
- 即输即建：`{ commodityName, categoryId?/categoryName?, unitId?/unitName?, quantity, unitPrice, lineTotal }`（即输即建需提供分类和单位）

**lineTotal 规则**：提供则原样持久化；否则 = quantity × unitPrice（舍入 2 位）。

## 数据分析

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/analytics/workbench?start&end` | 工作台聚合数据 |

- `start`/`end` 为 `YYYY-MM-DD`，半开区间 `[start, end+1day)`，Asia/Shanghai 时区
- 缺省默认近 1 个月；`start > end`/超 366 天 → 422

**响应结构**
```json
{
  "kpis": { "totalAmount": 0, "orderCount": 0, "commodityCount": 0, "avgOrderAmount": 0 },
  "dailyTrend": [{ "date": "2026-08-24", "total": 0, "slotAmounts": [0], "otherAmount": 0, "otherCount": 0, "orders": [] }],
  "topCommodities": { "byAmount": [], "byQuantity": [] },
  "categoryShare": [],
  "purchasePlaceShare": [],
  "orderSizeDistribution": [{ "bucket": "0-1k", "count": 0 }]
}
```

## 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查（DB + Redis 连通性，公开） |
