# Spec: 订单详情页精修

## 概述

订单详情页第二轮精修：返回按钮移入面包屑行、Descriptions 布局调整、明细表格滚动修复、明细头部精简、总结栏一体化。涉及 `OrderDetail.tsx`、`AppShell.tsx`、`index.css`。

## Requirement: 返回按钮位于面包屑行最右侧

订单详情页的「返回」按钮 SHALL 位于面包屑同一行的最右侧，以纯文本形式显示，不带图标。

### Scenario: 返回按钮位置与样式

- WHEN 用户进入订单详情页
- THEN 面包屑行右侧 SHALL 显示「返回」按钮（纯文本，无图标）
- THEN 按钮 SHALL 与面包屑同一水平行，靠最右侧对齐
- THEN 点击「返回」SHALL 跳转到订单列表页（/orders）

### Scenario: 其他页面无残留

- WHEN 用户离开订单详情页（导航到其他页面）
- THEN 面包屑行右侧 SHALL 不显示返回按钮

## Requirement: Descriptions 备注单独一行、进货金额带单位

订单详情信息卡片的 Descriptions SHALL 将备注置于单独一整行；进货金额 SHALL 带 `¥` 单位前缀。

### Scenario: 备注独占整行

- THEN Descriptions 中「备注」项 SHALL 独占一整行（span=3）
- THEN 备注内容较长时 SHALL 自动换行完整显示

### Scenario: 进货金额单位

- THEN Descriptions 中「进货金额」值 SHALL 以 `¥` 开头，如 `¥56.50`

## Requirement: 明细表格滚动到底且下边距可见

明细表格滚动区域 SHALL 基于容器实际高度动态计算，用户 SHALL 能滚动到最后一行，且表格底部保留可见下边距。

### Scenario: 动态滚动高度

- THEN 明细表格的 `scroll.y` SHALL 由 ResizeObserver 测量容器高度动态计算
- THEN 窗口尺寸或布局变化时 SHALL 自动重算
- THEN 滚动到最后一行 SHALL 完整可见，底部有预留下边距（≥12px）

### Scenario: 无 JS 报错

- THEN ResizeObserver 观察与清理 SHALL 正确配对，无内存泄漏/重复观察

## Requirement: 明细头部精简

明细列表标题 SHALL 与操作按钮同一行展示；「共 x 项」文本 SHALL 被移除。

### Scenario: 标题与按钮同行

- THEN 明细卡片头部第一行左侧为「明细列表」标题，右侧为「导出 Excel」「添加明细」按钮
- THEN 页面 SHALL 不显示「共 x 项」文本

## Requirement: 总结栏两层结构

分类总结栏 SHALL 以两层结构呈现：上层完整展示所有分类，下层为总计区，与明细表格形成连续边界。

### Scenario: 上层分类区

- THEN 上层分类区 SHALL 完整展示所有分类（不压缩、自动换行）
- THEN 每个分类段 SHALL 以竖分隔线区分
- THEN 分类段 SHALL 显示：分类名 + 商品种数（去重）+ 分类金额（¥）
- THEN 分类金额 SHALL 以 accent 色、等宽数字显示

### Scenario: 下层总计区

- THEN 下层总计区 SHALL 左对齐显示规模文案（共 x 个分类 · x 项明细）
- THEN 下层总计区 SHALL 右对齐显示「总计 ¥」金额，accent 色、较大字号
- THEN 总计区 SHALL 以 accent 浅色背景区别于分类区

### Scenario: 与表格连续边界

- THEN 总结栏 SHALL 无下边框、顶部圆角，与明细表格（无上边框、底部圆角）拼接成连续块

### Scenario: 空明细隐藏

- THEN 明细为空时总结栏 SHALL 隐藏

### Scenario: 移动端

- THEN ≤479px 时分类段 SHALL 纵向堆叠（去竖线、改底部分隔线）
- THEN ≤479px 时总计区 SHALL 改列向排列

### Scenario: 明暗主题

- THEN 亮色主题下总结栏为浅色表面、`--line` 边框、`--accent` 分隔
- THEN 暗色主题下总结栏背景为深色表面，总计区 accent 透明度提高以保持对比
