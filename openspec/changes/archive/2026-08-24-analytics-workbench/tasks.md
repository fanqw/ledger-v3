## 1. 前置准备

- [ ] 1.1 从 `origin/main` 创建分支 `feature/p5-analytics-workbench`
- [ ] 1.2 前端安装依赖：`pnpm --filter web add echarts`（按需引入 echarts/core）
- [ ] 1.3 共享包新增 `analyticsQuerySchema`（start/end 为 `YYYY-MM-DD`，缺失默认近 1 个月，start>end/超366天/非法日期 → 422）与 `AnalyticsWorkbenchResponse` DTO 类型

## 2. 后端 AnalyticsModule（TDD）

- [ ] 2.1 编写 `analytics.service.spec.ts` 失败测试：空数据返回零值 KPI/空图表
- [ ] 2.2 实现 `analytics.service.ts` 的 `getWorkbench(start, end)`：一次性拉取范围订单（order.findMany + include items/commodity/category/purchasePlace），软删除过滤 order/orderItem
- [ ] 2.3 实现 KPI 聚合（采购总金额/订单总数/商品种类/平均订单金额，除数 0 时 avg 为 0）
- [ ] 2.4 实现每日采购趋势聚合（按日分组；当日按金额降序/createdAt升序/id升序取前8，返回 slotAmounts[8] + otherAmount + otherCount + orders[]）
- [ ] 2.5 实现热购商品 Top10 排行（金额/数量，内存累加 + 稳定排序）
- [ ] 2.6 实现分类金额占比聚合（内存按 commodity.categoryId 累加，含商品数/订单数）
- [ ] 2.7 实现进货地金额占比聚合（内存按 order.purchasePlaceId 累加，无进货地归 `{ purchasePlaceId: null, name: '未指定' }`）
- [ ] 2.8 实现订单规模分布分桶（半开区间：0-1k[0,1000]、1k-5k(1000,5000]、5k-10k(5000,10000]、10k-50k(10000,50000]、50k+(50000,∞)，恒返回 5 桶）
- [ ] 2.9 金额聚合用整数"分"累加、quantity 用整数"千分位"累加，最终输出 `round2`/`÷1000` 序列化为 number；percentage 1 位小数；基础资料软删除不参与过滤
- [ ] 2.10 实现 `analytics.controller.ts` + `analytics.module.ts`（JwtAuthGuard、Zod query 校验、Swagger）
- [ ] 2.11 注册 `AnalyticsModule` 到 `app.module.ts` + 更新 `app.module.spec.ts`
- [ ] 2.12 分桶/日期边界测试：1000/5000/10000/50000 边界归属、end 当天包含、跨月/跨年/闰日、start>end 422
- [ ] 2.13 软删除/去重/排序测试：已删除订单排除、已删商品金额仍计、重复 commodity 去重、金额/数量/分类/进货地排序规则全覆盖、同金额按名称升序
- [ ] 2.14 精度、series 与一致性约束测试：金额整数分累加无浮点误差（如 0.1×3=0.3）、quantity 千分位累加无误差（如 0.1+0.2=0.3）、空数据 orderSizeDistribution 恒 5 桶、近 12 个月数据 ECharts series 数 ≤ 9；dailyTrend 约束（orders.length≤8、slotAmounts[i]===orders[i].amount、total===sum+otherAmount、otherCount===max(n-8,0)、otherCount=0 时 otherAmount=0）
- [ ] 2.15 运行 `pnpm --filter server test -- --testPathPattern="analytics"` 全绿

## 3. 前端数据分析页面

- [ ] 3.1 创建 `useECharts` hook（初始化/option 更新/resize/dispose，含清理）
- [ ] 3.2 实现时间范围 Chip 选择器（近1/3/6/12月按日历月回退、自定义起止日期，默认近1月，未确认不发请求）
- [ ] 3.3 实现 KPI 卡片组件（采购总金额/订单总数/商品种类/平均订单金额）
- [ ] 3.4 实现每日采购趋势堆叠柱状图（**固定 9 series**：slot1-8 + other；订单名放 data item 由 Tooltip 读取；dataZoom + tooltip 含"其他 N 笔"）
- [ ] 3.5 实现热购商品排行 Top10（金额/数量双 Tab）
- [ ] 3.6 实现分类金额占比环形图（中心显示总金额 + tooltip 含占比/商品数/订单数）
- [ ] 3.7 实现进货地金额占比环形图（tooltip 含占比/订单数，"未指定"扇区）
- [ ] 3.8 实现订单规模分布直方图（5 个金额区间，空数据"暂无数据"占位）
- [ ] 3.9 实现加载/错误/空数据状态：骨架屏、失败重试、快速切换忽略过期响应（AbortController）；金额展示统一 `toFixed(2)`
- [ ] 3.10 组装 `Analytics.tsx` 页面：Chip 切换 → 重算日期 → fetch → 全部图表更新
- [ ] 3.11 `App.tsx` 注册 `/analytics` 懒加载路由 + `SideNav` 新增「数据分析」入口
- [ ] 3.12 `pnpm --filter web build` + lint 通过

## 4. 验证与收尾

- [ ] 4.1 后端全量测试 + `pnpm build` 通过
- [ ] 4.2 启动 dev 环境，浏览器验证工作台（ECharts 渲染、Chip 切换刷新、KPI 正确、空数据/错误态）
- [ ] 4.3 补充 E2E 脚本验证核心链路（页面加载、时间切换、无 JS 错误）
- [ ] 4.4 性能验收：近 12 个月全量数据，接口响应 + 首屏渲染 ≤ 3s
- [ ] 4.5 验证数据隔离（测试数据清理，无残留）
- [ ] 4.6 提交 + PR → review → 合入 main
- [ ] 4.7 验证完成后，用 `openspec-sync-specs` 将 delta spec 同步进主规格 `analytics-workbench`（实施期间主规格保持实施前状态，不提前声明未实现行为）
- [ ] 4.8 同步主规格后归档 change，并同步修订 PRD §5/§8/§11 与 API 清单对齐本规格基线（一次性完成，避免部分同步）
