# Design: purchase-place-split

## 数据模型

```prisma
// 进货地 = 城市
model PurchasePlace {
  id          String    @id @default(cuid())
  place       String    // 城市名
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  markets     Market[]
  @@index([place])
}

// 市场 = 城市中的市场
model Market {
  id          String         @id @default(cuid())
  name        String
  cityId      String
  description String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  deletedAt   DateTime?
  city        PurchasePlace  @relation(fields: [cityId], references: [id], onDelete: Restrict)
  orders      Order[]
  @@index([name])
  @@index([cityId])
}

// 超市 = 独立
model Supermarket {
  id          String    @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  @@index([name])
}

// 订单：purchasePlaceId → marketId
model Order {
  // ...
  marketId String?        // 原 purchasePlaceId
  market   Market?        @relation(fields: [marketId], references: [id], onDelete: Restrict)
  @@index([marketId])
}
```

唯一性遵循项目惯例：schema 只写 `@@index`，部分唯一索引在迁移 SQL 手工加 `CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL`。

## API

| 资源 | 端点（前缀 /api） | 说明 |
|------|------------------|------|
| 进货地(城市) | `purchase-places`（不变） | 去掉 marketName，place 唯一，删除检查市场引用 |
| 市场 | `markets` | name+cityId+description，name 唯一，删除检查订单引用 |
| 超市 | `supermarkets` | name+description，name 唯一，删除无引用检查 |
| 订单 | `orders`（不变） | 字段 purchasePlaceId → marketId |

## 错误码

- `MARKET_EXISTS`（市场名称已存在）
- `MARKET_IN_USE`（该市场已被订单引用，无法删除）
- `SUPERMARKET_EXISTS`（超市名称已存在）
- `PURCHASE_PLACE_IN_USE` 消息改为"该进货地已被市场引用，无法删除"

## 前端路由与菜单

- 菜单「进货管理」（key `purchasing`）：进货地 `/purchase-places`、市场管理 `/markets`、超市管理 `/supermarkets`
- 物料管理移除进货地
- 订单下拉显示 `市场名 (城市)`
