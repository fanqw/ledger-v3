## Why

P4 订单管理已完成，数据已可沉淀（订单 + 明细 + 分类/单位/进货地关联）。但目前用户无法从宏观视角审视采购情况——需要数据分析工作台将订单数据聚合为 KPI 和可视化图表，支撑日常经营决策。这是执行计划 P5 阶段，`openspec/specs/analytics-workbench/spec.md` 已定义完整行为规格，本 change 将其落地。

## What Changes

- **新增后端 AnalyticsModule**：提供 `GET /api/analytics/workbench` 聚合端点，按时间范围返回 KPI、每日趋势、热购排行、分类/进货地占比、订单规模分布数据（基于 Prisma `findMany` + `include` 一次性拉取范围订单及关联数据，由 `AnalyticsService` 完成内存聚合；不依赖 `groupBy`，未删除订单与明细）。
- **新增前端数据分析工作台页面**（`/analytics`）：
  - Chip 式时间范围选择器（近1/3/6/12月、自定义），默认近1月，切换后全局刷新
  - 4 张 KPI 卡片（采购总金额、订单总数、商品种类、平均订单金额）
  - 每日采购趋势堆叠柱状图（支持 Zoom 拖拽缩放、悬浮显示订单明细）
  - 热购商品排行 Top10（金额/数量双 Tab）
  - 分类金额占比环形图（中心显示总金额）
  - 进货地金额占比环形图
  - 订单规模分布直方图（0-1k / 1k-5k / 5k-10k / 10k-50k / 50k+）
- **新增前端图表依赖**：`echarts`（PRD 4.2 明确选型，V2 延续），按需引入。
- **SideNav 新增「数据分析」入口**，路由 `/analytics` 懒加载。

> **与 PRD 的差异说明**：
> - PRD §5 描述 7 个模块（含月度双轴趋势图、环比变化率、价格波动分析、进货地排行柱状图）；PRD §8 为 5 类图表；PRD §11（旧版）仍写"6 图 + 单品分析"且 API 清单保留 `/api/analytics/commodity`。
> - 本 change 以 **OpenSpec 主规格 `analytics-workbench` 为准**：时间筛选、每日堆叠趋势（含单日>8笔聚合"其他"）、环形图占比、直方图分布，KPI 4 项（总金额/订单数/商品种类/平均订单金额）。
> - 与 PRD 冲突项（环比变化率、价格波动分析/单品分析、月度双轴图、月度趋势）**不在本 change 范围**。本 change 合入后，PRD §5/§8/§11 需同步修订以对齐本规格（见 tasks 4.x），若需单品分析须另行 proposal 补充 capability。
> - **需求基线**：以本 OpenSpec change 及其主规格为唯一基线；PRD 为产品背景参考，冲突时以本规格为准。

## Capabilities

### New Capabilities

- `analytics-workbench`: 数据分析工作台——时间范围筛选、KPI 概览、每日采购趋势（堆叠柱状图+zoom）、热购商品排行、分类/进货地金额占比（环形图）、订单规模分布（直方图）

### Modified Capabilities

<!-- 无既有 capability 的规格行为变更 -->

## Impact

- **后端**：新增 `apps/server/src/modules/analytics/`（module/controller/service），`app.module.ts` 注册 `AnalyticsModule`；新增 `apps/server/src/modules/analytics/__tests__/analytics.service.spec.ts`
- **前端**：新增 `apps/web/src/pages/Analytics.tsx`；`App.tsx` 注册 `/analytics` 路由；`SideNav` 增加入口；`apps/web/package.json` 新增 `echarts` 依赖
- **共享**：新增 `analyticsQuerySchema`（start/end 查询参数校验）与分析结果 DTO 类型定义；聚合端点无请求体 Schema
- **数据**：只读聚合查询，不修改任何表结构，无 Prisma migration
- **依赖**：`echarts`（前端，新增）
