# Proposal: purchase-place-split

## Summary

将现有"进货地"（PurchasePlace，`place` + `marketName` 双字段）拆分为三个独立主数据：**进货地（城市）**、**市场管理（城市中的市场，关联城市）**、**超市管理（消费超市，独立）**。订单的进货地字段从关联 PurchasePlace 改为关联 **Market**。三者归入新建「进货管理」父菜单。

## Motivation

现有 PurchasePlace 把"城市"和"市场"合并为一条记录（如"晋城 + 长治市场"），订单只能选择城市+市场的组合。实际业务中"进货地（城市）、市场、超市"是三类独立且需要分别维护的主数据：
- 进货地：晋城、郑州、洛阳（城市）
- 市场：长治市场、宏进市场（城市下的市场，关联城市）
- 超市：端氏、嘉峰（进货后消费的超市，独立）

拆分后可独立维护三类资料，订单按"市场"维度选择进货来源，展示 `市场名 (城市)`。

## Scope

### In Scope
- **PurchasePlace 改造为城市管理**：去掉 `marketName`，仅保留 `place`（城市）+ `description`，`place` 唯一
- **新建 Market（市场）模块**：`name` + `cityId`（关联城市）+ `description`，`name` 唯一，被订单引用时禁止删除
- **新建 Supermarket（超市）模块**：`name` + `description`，`name` 唯一，独立无关联
- **Order 改造**：`purchasePlaceId` → `marketId`（关联 Market），列表/详情/搜索/展示同步
- **Analytics 改造**：进货地占比 → 市场占比（`marketShare`）
- **菜单**：新建「进货管理」父菜单（进货地/市场管理/超市管理），物料管理移除进货地
- **前端**：PurchasePlaces 改造、Markets/Supermarkets 新建、Orders/OrderDetail/Analytics 改造、路由

### Out of Scope
- 超市进订单（订单仅关联市场，用户确认）
- 历史数据迁移（无存量采购数据）
- 导入/导出、权限细分

## Glossary
- 进货地（PurchasePlace）：城市，如晋城、郑州
- 市场（Market）：城市中的批发市场，如长治市场，关联城市
- 超市（Supermarket）：进货后消费的超市，如端氏、嘉峰，独立
