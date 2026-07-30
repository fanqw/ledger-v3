# analytics-workbench

## Purpose

定义数据分析工作台的行为规格，包括时间范围筛选入口、KPI 概览卡片、每日采购趋势（堆叠柱状图+zoom）、热购商品排行（数量/金额双 Tab）、分类金额占比（环形图）、进货地金额占比（环形图）、订单规模分布（直方图）。

## Requirements

### Requirement: 时间范围筛选入口

工作台顶部 SHALL 提供 Chip 式时间范围选择器，预设选项为：近1个月、近3个月、近6个月、近12个月、自定义。进入工作台时 SHALL 默认选中"近1个月"。

#### Scenario: 默认选中近1个月

- WHEN 用户进入工作台页面
- THEN 时间范围选择器 SHALL 默认选中"近1个月"（高亮样式）
- THEN 所有 KPI 和图表 SHALL 以近1个月为条件请求数据

#### Scenario: 切换时间范围后全局图表更新

- WHEN 用户点击"近3个月"Chip
- THEN 该 Chip SHALL 变为选中态（蓝底白字），其余 Chip 恢复默认态
- THEN 所有 KPI 卡片和图表 SHALL 更新为近3个月的数据

#### Scenario: 自定义时间范围

- WHEN 用户点击"自定义"Chip 并选择起止日期
- THEN 所有数据 SHALL 限制在该日期范围内

### Requirement: KPI 概览卡片

工作台顶部 SHALL 展示 4 张 KPI 指标卡片：采购总金额（元）、订单总数、商品种类、本月订单数。

#### Scenario: KPI 卡片数据加载

- WHEN 用户进入工作台页面
- THEN 系统 SHALL 通过 GET /api/analytics/workbench 获取数据
- THEN 页面 SHALL 渲染 4 张 KPI 卡片，各显示当前时间范围内的统计值

#### Scenario: 时间范围筛选影响 KPI

- WHEN 用户切换时间范围
- THEN 4 张 KPI 卡片 SHALL 更新为对应时间范围内的统计数据

### Requirement: 每日采购趋势

系统 SHALL 以堆叠柱状图展示所选时间范围内的每日采购趋势。X 轴为日期，Y 轴为采购金额（元），每个柱状块对应当日的一笔订单的采购总额。图表 SHALL 支持 Zoom 拖拽调节可视时间范围。

#### Scenario: 堆叠柱状图渲染

- WHEN 用户查看工作台
- THEN 系统 SHALL 渲染一张堆叠柱状图：X 轴为日期（按天），Y 轴为金额
- THEN 每一天的柱子 SHALL 由该日各笔订单的采购金额堆叠而成，每块颜色不同以区分不同订单

#### Scenario: Zoom 控制

- WHEN 用户拖拽图表底部的 Zoom Bar
- THEN 图表 SHALL 缩放至所选时间区间，X 轴显示对应日期范围

#### Scenario: 鼠标悬浮显示详情

- WHEN 用户将鼠标悬浮在某一天的柱子上
- THEN 系统 SHALL 显示 Tooltip，包含：日期、当日各订单的金额明细、当日订单总金额
- THEN 悬浮在某个堆叠块上时 SHALL 高亮该块并显示对应订单的金额

### Requirement: 热购商品排行

系统 SHALL 以列表形式展示采购 Top 10 商品，支持「数量排行」和「金额排行」两个 Tab 切换。

#### Scenario: 默认显示金额排行

- WHEN 用户查看工作台
- THEN 热购商品排行区域 SHALL 默认显示"金额排行"Tab，列出采购金额最高的 10 个商品及其金额

#### Scenario: 切换为数量排行

- WHEN 用户点击"数量排行"Tab
- THEN 列表 SHALL 切换为按采购数量降序排列的 Top 10 商品及其数量

### Requirement: 分类金额占比

系统 SHALL 以环形图（Donut）展示各 Category 的采购金额占比，中心显示总金额。

#### Scenario: 环形图渲染

- WHEN 用户查看工作台
- THEN 系统 SHALL 渲染一张环形图，各扇区对应不同分类的采购金额
- THEN 环形图中心 SHALL 显示总采购金额

#### Scenario: 悬停显示详情

- WHEN 用户将鼠标悬停在环形图某扇区上
- THEN 系统 SHALL 显示 Tooltip，包含分类名称、占比百分比、金额、商品数、订单数

### Requirement: 进货地金额占比

系统 SHALL 以环形图（Donut）展示各进货地（PurchasePlace）的采购金额占比。

#### Scenario: 进货地环形图渲染

- WHEN 用户查看工作台
- THEN 系统 SHALL 渲染一张环形图，各扇区对应不同进货地的采购金额
- THEN 悬停时 SHALL 显示 Tooltip，包含进货地名称、占比、金额、订单数

### Requirement: 订单规模分布

系统 SHALL 按订单总金额分桶，统计各金额区间的订单数量，以直方图展示。

#### Scenario: 订单规模分布渲染

- WHEN 用户查看工作台
- THEN 系统 SHALL 渲染一张直方图，X 轴为金额区间（0-1k、1k-5k、5k-10k、10k-50k、50k+），Y 轴为订单数量
