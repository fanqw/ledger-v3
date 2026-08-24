## Context

P4 订单管理已落地：`Order`/`OrderItem` 数据可沉淀，`order.service.ts` 提供 CRUD，`commodity` 关联 `category`/`unit`，`order` 关联 `purchasePlace`。用户现在需要从订单数据中获取经营洞察。本 change 新增数据分析工作台，后端聚合 + 前端可视化。

当前状态：
- 后端 `apps/server/src/modules/order/` 已有 order CRUD，无任何聚合查询
- 前端 `App.tsx` 已有 `/orders` 等路由，`SideNav` 有「订单」「物料管理」两组菜单
- 前端无图表库（`echarts` 待引入）
- Prisma `OrderItem` 含 `quantity(12,3)`、`unitPrice(12,2)`、`lineTotal(12,2)`，软删除字段 `deletedAt`

## Goals / Non-Goals

**Goals:**
- 后端提供单一聚合端点 `GET /api/analytics/workbench`，按时间范围返回全部工作台数据
- 前端实现时间范围筛选 + 4 KPI 卡片 + 5 类图表，ECharts 渲染
- 数据只读，不修改表结构，无 migration
- 遵循现有规范：JWT 全局守卫、`{ success, data }` 响应、软删除过滤、Zod query 校验

**Non-Goals:**
- PRD §5 的「月度双轴趋势图、环比变化率、价格波动分析、进货地排行柱状图」不在本 change（以 OpenSpec 主规格为准）
- PRD §11 的「单品分析」（`/api/analytics/commodity`）不在本 change；如需补充须另建 proposal
- 图表下钻（点击图表进入明细）、数据导出
- 服务端缓存（数据量小，千级，每次实时聚合足够）

## Decisions

### D1：单一聚合端点 vs 多个端点
- **选择**：单一 `GET /api/analytics/workbench?start&end`
- **理由**：工作台所有数据共享同一时间范围，一次请求返回全部避免 6 次并发；数据量小，聚合成本低
- **备选**：按模块拆分端点 → 请求次数多、前端拼接复杂，否决

### D2：时间范围参数设计
- **选择**：前端计算 `start`/`end`（`YYYY-MM-DD`），请求携带；后端只认日期区间，逻辑简单，支持自定义范围
- **边界契约**：半开区间 `[start 00:00, end + 1 day 00:00)`；按 `Asia/Shanghai` 解释日期；`start > end`、非法日期、超 366 天、只给一个日期 → 422
- **预设范围**：前端按日历月回退——"近 N 个月" = `start` 为当月首日往前回退 N-1 个月，`end` 为当日；界面保持"近 N 个月"
- **查询校验**：新增 `analyticsQuerySchema`（shared），`start`/`end` 为可选 `YYYY-MM-DD`（匹配 `^\d{4}-\d{2}-\d{2}$`），缺失时后端默认近 1 个月
- **备选**：后端传 `range=1m/3m` → 自定义范围无法表达，否决

### D3：后端聚合实现（查询 + service 内存聚合）

> **模型约束**：`OrderItem` 只有 `orderId`/`commodityId` 直接字段，`categoryId` 在 `Commodity`、`purchasePlaceId` 在 `Order`。Prisma `groupBy` 不能按关联表字段分组，因此**采用一次查询拉取范围数据 + service 内存聚合**，不依赖 `groupBy`。

- **数据拉取**：`order.findMany({ where: { createdAt: [start, end), deletedAt: null }, include: { items: { where: { deletedAt: null }, include: { commodity: { include: { category: true } } } }, purchasePlace: true } })`
- **KPI**：内存遍历计算——采购总金额（items 的 lineTotal 之和）、订单总数（orders.length）、商品种类（去重 commodityId 数）、平均订单金额（总金额 ÷ 订单总数）
- **每日趋势**：按 `order.createdAt` 的日期分组，每日汇总当日各订单金额；每笔订单作为独立数据点供前端堆叠
- **热购排行**：内存按 `commodityId` 累加 `lineTotal`/`quantity`，关联名称，金额/数量降序取 10
- **分类占比**：内存按 `item.commodity.categoryId` 累加 `lineTotal`，关联分类名，同时统计商品数/订单数
- **进货地占比**：内存按 `order.purchasePlaceId` 累加订单金额，关联进货地名，同时统计订单数；无进货地订单归入「未指定」
- **订单规模分布**：按订单总金额分桶，区间定义如下（**半开区间，无歧义**）：
  - `0-1k`: `[0, 1000]`
  - `1k-5k`: `(1000, 5000]`
  - `5k-10k`: `(5000, 10000]`
  - `10k-50k`: `(10000, 50000]`
  - `50k+`: `(50000, +∞)`
  - 即边界值归入上一桶：1000→0-1k、5000→1k-5k、10000→5k-10k、**50000→10k-50k**、50000.01→50k+

> **关键过滤**：查询只排除已删除的 `order` 与 `orderItem`（deletedAt 软删除，业务事实数据口径）。**基础资料（commodity/category/unit/purchasePlace）不参与过滤**——已软删除商品/分类的历史订单金额仍计入 KPI（见 D3a 说明）。金额聚合采用**整数分累加**，最终输出时 `Number()` 并 `round2`（见 D3c）。

### D3a：软删除与基础资料口径

- **事实数据口径**：分析统计的是「历史发生的采购事实」，只排除已删除的订单和明细。商品、分类、进货地被软删除不改变历史事实，其历史金额**仍计入**。
- **展示名称**：已软删除的商品/分类/进货地，名称取现有关联记录（Prisma include 仍返回关联行的 name），无需特殊处理；若关联行已物理删除（本系统仅软删除，不会发生），兜底显示「已删除」。
- **Unit 不参与任何分析指标**，不作为查询条件。对比 `commodity.service.ts`（创建时校验 FK 存在）——本聚合是只读，不校验基础资料状态。

### D3b：每日趋势的固定 9-series 方案

> **评审项**：若按「一笔订单一个 ECharts series」实现，365 天 × 每天 8 笔 ≈ 2920 个 series，series 总量未受「每日最多 9 块」限制。

- **方案**：**固定 9 个跨日期 series**（slot1 ～ slot8 + other），而非每订单一个 series。
  - `slot1` 系列：所有日期的第 1 名订单金额（某日无则 0）
  - `slot2` 系列：所有日期的第 2 名订单金额（依此类推至 slot8）
  - `other` 系列：所有日期超出前 8 的订单金额之和（某日 ≤8 笔则为 0）
  - 每个 slot 系列的数据项 `{ value: number, orderId?, orderName?, orderAmount? }`——订单 ID/名称/金额放在**数据项内部**，Tooltip 从对应 data item 读取，不在 series 层面维护。
- **series 总数恒定**：无论范围多大、订单多少，ECharts 的 series 数恒为 **9**（8 + other），不随订单增长。
- **图例**：显示 8 个 slot 名称（"1"～"8"）+ "其他"；slot 图例含义为「当日该序位订单」，hover 时从 data item 读具体订单名。
- **后端返回结构**：`dailyTrend` 每项 `{ date, slotAmounts: [8 个 number], otherAmount, otherCount, orders: [{ id, name, amount }] }`。`orders` 数组 ≤8 笔（仅前 8），`otherAmount`/`otherCount` 为其余汇总。
- **排序规则**（P1-②）：当日订单按**金额降序**；金额相同时按 **createdAt 升序**；再相同按 **id 升序**。前 8 笔单独展示，其余归入「其他」。
- **Tooltip**：展示该日前 8 笔订单（名称+金额）及「其他 N 笔 ¥X」，N 来自 `otherCount`。
- **测试**：近 12 个月全量数据下，断言前端 ECharts option 的 series 数恒 ≤ 9。

### D3c：金额精度策略

> **评审项**：JSON number 无法携带尾随零（`12.50` 解析为 `12.5`）；直接 `Number` 累加可能引入浮点误差。

- **累加**：金额统一以**整数"分"**累加——`Math.round(Number(lineTotal) * 100)` 为每个明细金额，后续所有聚合（KPI、每日、排行、占比、分桶）都用整数分运算，**避免浮点误差累积**。
- **输出**：最终返回前端时 `分 → 元`（`/ 100`）并 `round2` 到 2 位小数。JSON 序列化为 number（如 `12.5`），**展示层**（前端）统一用 `toFixed(2)` 格式化。
- **quantity**：以 Decimal(12,3) 存储，**累加/排序用整数"千分位"**——`Math.round(Number(quantity) * 1000)` 聚合，输出时 `÷ 1000` 为 `Number`（最多 3 位小数），避免 `0.1 + 0.2` 等浮点误差。
- **percentage**：`round1(amount / total * 100)`，1 位小数；前端显示补 `%`。
- **avgOrderAmount**：`round2(totalAmountFen / 100 / orderCount)`，`orderCount === 0` 时返回 0。

### D4：前端图表库 echarts
- **选择**：`echarts`（PRD 4.2 明确选型，V2 延续），按需引入（仅用到的图表类型）
- **理由**：堆叠柱状图+zoom、环形图、直方图均为 ECharts 原生能力；与 React 集成成熟
- **React 集成**：轻封装 `useECharts` hook（初始化、resize、setOption、dispose），不引入额外 react-echarts 封装层（保持依赖最小）
- **备选**：Recharts（React 原生但 zoom 弱）、D3（成本高）→ 否决

### D5：前端页面结构
- 路由 `/analytics`，懒加载 `Analytics.tsx`
- SideNav 新增「数据分析」section（或并入订单组），`BarChart3` 图标
- 状态：`range`（Chip 选中）、`start`/`end`（计算后的日期）、`data`（接口返回）、`loading`
- 切换 Chip → 重算日期 → `fetch` → 全部图表更新
- 页面组件拆分：`KpiCards`、`DailyTrendChart`、`TopCommodities`、`CategoryDonut`、`PurchasePlaceDonut`、`OrderSizeHistogram`，各组件接收 data + 渲染 ECharts

### D6：测试策略
- 后端 TDD：`analytics.service.spec.ts` 覆盖——空数据返回零值、时间过滤生效、KPI 计算正确（含 avgOrderAmount 除数 0）、热购排序、分桶边界、Decimal 序列化、未认证 401
- 分桶边界值测试：1000 归 0-1k、5000 归 1k-5k、10000 归 5k-10k、50000 归 10k-50k、50000.01 归 50k+
- 日期边界测试：end 当天包含、start 当天包含、跨月、跨年、闰日（2024-02-29）
- 软删除测试：已删除订单/明细不计入；已删除商品/分类/进货地的历史金额仍计入（基础资料口径）
- 无进货地订单归入「未指定」
- 稳定排序：同金额按名称升序
- 重复 commodity 跨订单去重计数
- 性能验收：近 12 个月全量数据（约千级订单），接口响应 + 首屏渲染 ≤ 3s
- 前端：浏览器 E2E（沿用 P4 Playwright 基建）验证页面加载、Chip 切换刷新、KPI 渲染、快速切换忽略过期响应

## Risks / Trade-offs

- **[聚合性能]** 内存聚合在订单数增长到万级后可能变慢 → 数据量当前千级，足够；若增长再改原生 SQL 聚合（`$queryRaw` JOIN + GROUP BY）
- **[金额精度]** 直接 Number 累加可能浮点误差 → 聚合用整数"分"累加，最终输出 `round2`（见 D3c）；展示层 `toFixed(2)`
- **[日期边界]** 时区按 Asia/Shanghai 固定 → 若部署地变更需同步调整；当前单机部署，足够
- **[自定义范围]** 前端日期选择器（原生 `input[type=date]`）→ 无新依赖，够用
- **[ECharts 体积]** 全量引入 echarts 体积较大 → 按需 `echarts/core` + 仅注册 BarChart/PieChart + 所需组件，控制 chunk
- **[堆叠系列]** 单日订单 > 8 时堆叠块数受限 → 后端聚合"其他"块，图例/颜色稳定（D3b）

## Migration Plan

无数据迁移（只读聚合）。部署顺序：后端 AnalyticsModule → 前端页面+路由 → 验证。回滚：移除模块/路由即可。

## Resolved Questions

1. 「近1个月」已按**日历月回退**定义（D2）——与 Pencil 设计稿"近1个月"一致，无歧义
2. 每日趋势图例：固定显示序位 1～8 和"其他"（D3b）；具体订单名称仅在 Tooltip 中展示，不进入图例
