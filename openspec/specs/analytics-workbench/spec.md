# analytics-workbench

## Purpose

定义数据分析工作台的行为规格，包括时间范围筛选入口、时间范围查询契约、KPI 概览卡片、每日采购趋势（堆叠柱状图+zoom，固定 9 series）、热购商品排行（数量/金额双 Tab，前三名样式）、分类金额占比（环形图）、进货地金额占比（环形图）、订单规模分布（直方图）、API 响应契约、加载与错误状态。

## Requirements

### Requirement: 时间范围筛选入口

工作台顶部 SHALL 提供 Chip 式时间范围选择器，预设选项为：近1个月、近3个月、近6个月、近12个月、自定义。进入工作台时 SHALL 默认选中"近1个月"。

#### Scenario: 默认选中近1个月

- **WHEN** 用户进入工作台页面
- **THEN** 时间范围选择器 SHALL 默认选中"近1个月"（高亮样式）
- **THEN** 所有 KPI 和图表 SHALL 以近1个月为条件请求数据

#### Scenario: 切换时间范围后全局图表更新

- **WHEN** 用户点击"近3个月"Chip
- **THEN** 该 Chip SHALL 变为选中态（蓝底白字），其余 Chip 恢复默认态
- **THEN** 所有 KPI 卡片和图表 SHALL 更新为近3个月的数据

#### Scenario: 自定义时间范围

- **WHEN** 用户点击"自定义"Chip 并选择起止日期
- **THEN** 所有数据 SHALL 限制在该日期范围内

### Requirement: 时间范围查询契约

工作台所有数据请求 SHALL 通过 `GET /api/analytics/workbench?start&end` 完成，时间范围参数 SHALL 遵循统一的边界与校验规则。

#### Scenario: 参数格式与边界

- **WHEN** 前端请求工作台数据
- **THEN** `start`、`end` SHALL 为 `YYYY-MM-DD` 格式的日期字符串
- **THEN** 数据范围 SHALL 为半开区间 `[start 00:00, end + 1 day 00:00)`，即 end 当天整天包含在范围内
- **THEN** 日期边界 SHALL 按 `Asia/Shanghai` 时区解释

#### Scenario: 预设范围按日历月回退

- **WHEN** 用户点击"近 N 个月"Chip
- **THEN** 前端 SHALL 计算 `start = 当月首日往前回退 N-1 个月`、`end = 当日`
- **THEN** 界面名称保持"近 N 个月"（不改为天数表述）

#### Scenario: 非法参数响应

- **WHEN** `start`、`end` 为非法日期、缺失其一、`start > end`，或范围超过 366 天
- **THEN** 系统 SHALL 返回 HTTP 422（VALIDATION_ERROR），拒绝请求
- **THEN** 自定义范围仅选择一个日期时 SHALL 视为非法（需同时提供起止日期）

### Requirement: KPI 概览卡片

工作台顶部 SHALL 展示 4 张 KPI 指标卡片：采购总金额（元）、订单总数、商品种类、平均订单金额。四张卡片 SHALL 均随所选时间范围更新。

#### Scenario: KPI 卡片数据加载

- **WHEN** 用户进入工作台页面
- **THEN** 系统 SHALL 通过 GET /api/analytics/workbench 获取数据
- **THEN** 页面 SHALL 渲染 4 张 KPI 卡片，各显示当前时间范围内的统计值
- **THEN** 平均订单金额 SHALL 为采购总金额 ÷ 订单总数（订单总数为 0 时显示 0.00）

#### Scenario: 时间范围筛选影响 KPI

- **WHEN** 用户切换时间范围
- **THEN** 4 张 KPI 卡片 SHALL 更新为对应时间范围内的统计数据

### Requirement: 每日采购趋势

系统 SHALL 以堆叠柱状图展示所选时间范围内的每日采购趋势。X 轴为日期，Y 轴为采购金额（元），每个柱状块对应当日的一笔订单的采购总额。图表 SHALL 支持 Zoom 拖拽调节可视时间范围，且 ECharts 的 series 总数 SHALL 恒定不超过 9。

#### Scenario: 堆叠柱状图渲染

- **WHEN** 用户查看工作台
- **THEN** 系统 SHALL 渲染一张堆叠柱状图：X 轴为日期（按天），Y 轴为金额
- **THEN** 每一天的柱子 SHALL 由该日各笔订单的采购金额堆叠而成，每块颜色不同以区分不同订单

#### Scenario: 固定 series 数量

- **WHEN** 图表渲染近 12 个月数据（约千级订单）
- **THEN** ECharts 的 series 总数 SHALL 恒定为 9（slot1 ～ slot8 + other），不随订单数量增长

#### Scenario: 前 8 笔订单的排列规则

- **WHEN** 某日订单数超过 8 笔
- **THEN** 当日订单 SHALL 按金额降序排列；金额相同 SHALL 按 createdAt 升序；再相同 SHALL 按 id 升序
- **THEN** 前 8 笔订单 SHALL 单独展示，其余订单 SHALL 聚合为"其他"块（金额之和 + 笔数）

#### Scenario: Zoom 控制

- **WHEN** 用户拖拽图表底部的 Zoom Bar
- **THEN** 图表 SHALL 缩放至所选时间区间，X 轴显示对应日期范围

#### Scenario: 鼠标悬浮显示详情

- **WHEN** 用户将鼠标悬浮在某一天的柱子上
- **THEN** 系统 SHALL 显示 Tooltip，包含：日期、前 8 笔订单的名称与金额、当日订单总金额
- **THEN** 当日有超出前 8 的订单时，Tooltip SHALL 额外显示"其他 N 笔 ¥X"（N 为该日订单数减 8）
- **THEN** 悬浮在 slot1～slot8 堆叠块上时 SHALL 高亮该块并显示对应订单的名称与金额
- **THEN** 悬浮在"其他"堆叠块上时 SHALL 高亮该块并显示"其他 N 笔"与汇总金额，不显示单笔订单名称

#### Scenario: dailyTrend 一致性约束

- **WHEN** 后端返回 dailyTrend 项
- **THEN** `orders.length` SHALL ≤ 8
- **THEN** `slotAmounts[i]` SHALL 等于 `orders[i].amount`（`orders` 中第 i 笔的金额）
- **THEN** `total` SHALL 等于 `sum(slotAmounts) + otherAmount`
- **THEN** `otherCount` SHALL 等于 `max(当日订单数 - 8, 0)`
- **THEN** `otherCount` 为 0 时 `otherAmount` SHALL 为 0

### Requirement: 热购商品排行

系统 SHALL 以列表形式展示采购 Top 10 商品，支持「数量排行」和「金额排行」两个 Tab 切换。

#### Scenario: 默认显示金额排行

- **WHEN** 用户查看工作台
- **THEN** 热购商品排行区域 SHALL 默认显示"金额排行"Tab，列出采购金额最高的 10 个商品及其金额

#### Scenario: 切换为数量排行

- **WHEN** 用户点击"数量排行"Tab
- **THEN** 列表 SHALL 切换为按采购数量降序排列的 Top 10 商品及其数量

### Requirement: 分类金额占比

系统 SHALL 以环形图（Donut）展示各 Category 的采购金额占比，中心显示总金额。

#### Scenario: 环形图渲染

- **WHEN** 用户查看工作台
- **THEN** 系统 SHALL 渲染一张环形图，各扇区对应不同分类的采购金额
- **THEN** 环形图中心 SHALL 显示总采购金额

#### Scenario: 悬停显示详情

- **WHEN** 用户将鼠标悬停在环形图某扇区上
- **THEN** 系统 SHALL 显示 Tooltip，包含分类名称、占比百分比、金额、商品数、订单数

### Requirement: 进货地金额占比

系统 SHALL 以环形图（Donut）展示各进货地（PurchasePlace）的采购金额占比。

#### Scenario: 进货地环形图渲染

- **WHEN** 用户查看工作台
- **THEN** 系统 SHALL 渲染一张环形图，各扇区对应不同进货地的采购金额
- **THEN** 悬停时 SHALL 显示 Tooltip，包含进货地名称、占比、金额、订单数

### Requirement: 订单规模分布

系统 SHALL 按订单总金额分桶，统计各金额区间的订单数量，以直方图展示。

#### Scenario: 订单规模分布渲染

- **WHEN** 用户查看工作台
- **THEN** 系统 SHALL 渲染一张直方图，X 轴为金额区间（0-1k、1k-5k、5k-10k、10k-50k、50k+），Y 轴为订单数量

#### Scenario: 分桶边界

- **WHEN** 订单总金额落在区间边界
- **THEN** 分桶 SHALL 按半开区间归属：`0-1k: [0, 1000]`、`1k-5k: (1000, 5000]`、`5k-10k: (5000, 10000]`、`10k-50k: (10000, 50000]`、`50k+: (50000, +∞)`
- **THEN** 1000 归 0-1k、5000 归 1k-5k、10000 归 5k-10k、**50000 归 10k-50k**、50000.01 归 50k+

### Requirement: API 响应契约

`GET /api/analytics/workbench` 的响应 SHALL 遵循统一 `{ success: true, data }` 结构，`data` 字段结构与排序规则 SHALL 固定，供前后端独立开发。

#### Scenario: 响应结构

- **WHEN** 前端请求工作台数据成功
- **THEN** 响应体 SHALL 为 `{ success: true, data: { ... } }`，`data` 包含以下字段：
  - `kpis`: `{ totalAmount, orderCount, commodityCount, avgOrderAmount }`，金额为 `number`（元，最多 2 位小数），计数为 `number`
  - `dailyTrend`: 按日期升序的数组，每项 `{ date: 'YYYY-MM-DD', total: number, slotAmounts: [8 个 number], otherAmount: number, otherCount: number, orders: [{ id, name, amount }] }`
    - `slotAmounts` 为该日第 1～8 名订单金额（不足补 0）
    - `orders` 为该日前 8 笔订单（含名称），`otherAmount`/`otherCount` 为其余订单汇总
  - `topCommodities`: `{ byAmount: [{ commodityId, name, amount, quantity }], byQuantity: [{ commodityId, name, quantity, amount }] }`，均按对应指标降序取前 10
  - `categoryShare`: 按金额降序的数组，每项 `{ categoryId, name, amount, percentage, commodityCount, orderCount }`
  - `purchasePlaceShare`: 按金额降序的数组，每项 `{ purchasePlaceId: string | null, name, amount, percentage, orderCount }`；无进货地订单归入 `{ purchasePlaceId: null, name: '未指定' }`
  - `orderSizeDistribution`: **恒定 5 项**，顺序固定 `['0-1k', '1k-5k', '5k-10k', '10k-50k', '50k+']`，每项 `{ bucket, count }`
- **THEN** 所有金额字段 SHALL 为 number（四舍五入至小数点后最多 2 位），`quantity` 最多 3 位小数
- **THEN** `percentage` SHALL 为 0-100 的 number（四舍五入至 1 位小数）
- **THEN** 任何字段 SHALL 不允许为 `null`（除 `purchasePlaceShare` 的 `purchasePlaceId` 可为 `null` 表示"未指定"）或缺失

#### Scenario: 空数据

- **WHEN** 所选时间范围内无任何订单
- **THEN** `kpis` SHALL 为 `{ totalAmount: 0, orderCount: 0, commodityCount: 0, avgOrderAmount: 0 }`
- **THEN** `dailyTrend`、`topCommodities.byAmount`、`topCommodities.byQuantity`、`categoryShare`、`purchasePlaceShare` SHALL 为空数组 `[]`
- **THEN** `orderSizeDistribution` SHALL 仍返回固定 5 桶，count 全为 0

#### Scenario: 排序稳定性

- **WHEN** 多个条目指标相同时
- **THEN** 排序 SHALL 按以下规则（金额/数量降序，次级按名称升序，再按 id 升序）：
  - 金额排行：`amount DESC, name ASC, commodityId ASC`
  - 数量排行：`quantity DESC, name ASC, commodityId ASC`
  - 分类占比：`amount DESC, name ASC, categoryId ASC`
  - 进货地占比：`amount DESC, name ASC, purchasePlaceId ASC`（"未指定"的 `purchasePlaceId` 为 `null`，参与 id 排序时置于末尾）

### Requirement: 加载与错误状态

工作台 SHALL 提供明确的加载、错误与空数据反馈。

#### Scenario: 加载中

- **WHEN** 用户首次进入工作台或切换时间范围，数据请求进行中
- **THEN** 页面 SHALL 显示加载状态（KPI 卡片与图表区域显示骨架屏或 loading 指示），不渲染旧数据混淆

#### Scenario: 请求失败

- **WHEN** 工作台数据请求失败
- **THEN** 页面 SHALL 显示错误提示（toast 或错误区域），并保留重试入口
- **THEN** 用户点击重试 SHALL 重新发起请求

#### Scenario: 快速切换时间范围

- **WHEN** 用户快速连续切换 Chip，前一次请求未完成
- **THEN** 页面 SHALL 取消过期请求或忽略过期响应，最终只渲染最新时间范围的结果

#### Scenario: 自定义范围未确认不发请求

- **WHEN** 用户点击"自定义"Chip 但尚未选择并确认起止日期
- **THEN** 系统 SHALL 不发起请求，保持当前数据

#### Scenario: 空数据图表

- **WHEN** 某图表在所选范围内无数据
- **THEN** 图表 SHALL 显示"暂无数据"占位，而非空白或异常坐标系
