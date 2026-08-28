# Tasks: purchase-place-split

## Phase 1：数据模型与共享层

- [ ] schema.prisma：PurchasePlace 去 marketName、新建 Market/Supermarket、Order 改 marketId
- [ ] 迁移：`pnpm --filter server db:migrate` + 手工加部分唯一索引（place/name）
- [ ] shared validators：purchasePlaceSchema 去 marketName、新增 marketSchema/supermarketSchema、order marketId
- [ ] shared constants：新增 MARKET_EXISTS/MARKET_IN_USE/SUPERMARKET_EXISTS，改 PURCHASE_PLACE_IN_USE 消息
- [ ] shared dto：PurchasePlaceDto 去 marketName、新增 MarketDto/SupermarketDto、OrderDto 改 market
- [ ] `pnpm --filter shared build`

## Phase 2：后端模块

- [ ] purchase-place 模块改造（findAll/create/update/delete + 测试）
- [ ] market 模块新建（module/controller/service + 测试）
- [ ] supermarket 模块新建（module/controller/service + 测试）
- [ ] order 模块改造（marketId + include market + 搜索 + 测试）
- [ ] analytics 改造（marketShare + 测试）
- [ ] app.module 注册 MarketModule + SupermarketModule
- [ ] `pnpm --filter server test`

## Phase 3：前端

- [ ] PurchasePlaces.tsx 改造（去 marketName）
- [ ] Markets.tsx 新建（name + 城市下拉 + description）
- [ ] Supermarkets.tsx 新建（name + description）
- [ ] Orders.tsx 改造（loadMarkets、marketId、显示 市场名(城市)）
- [ ] OrderDetail.tsx 改造（market 显示 + Excel 导出）
- [ ] Analytics.tsx 改造（marketShare）
- [ ] menu.tsx 新建「进货管理」父菜单、物料管理移除进货地
- [ ] App.tsx 新增 /markets /supermarkets 路由

## Phase 4：验证

- [ ] `pnpm build` / `pnpm lint`
- [ ] `pnpm --filter server test`（全量回归）
- [ ] Playwright：三块 CRUD、订单关联市场、菜单分组、Analytics
