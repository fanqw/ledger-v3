# Spec: 订单详情页明细区增强

## 概述

订单详情页明细区三项视觉/信息增强：明细列表标题独立成行、表格列分隔线与分类分组边界线、分类总结栏。涉及订单详情页明细表格（`apps/web/src/pages/OrderDetail.tsx`）与全局样式（`apps/web/src/index.css`）。

## Requirement: 明细列表标题独立成行

订单详情页明细卡片内，「明细列表」标题 SHALL 独立占用一行，操作按钮位于其下一行右侧。

### Scenario: 标题与按钮分行

- WHEN 用户进入订单详情页
- THEN 「明细列表」标题单独显示在第一行，字体为 antd Title level=5 级别
- THEN 「共 x 项」次要信息 SHALL 紧邻标题右侧显示
- THEN 「导出 Excel」「添加明细」按钮 SHALL 位于标题下方一行、右对齐
- THEN 明细为空时标题行与按钮行 SHALL 正常显示，总结栏 SHALL 隐藏

## Requirement: 表格列分隔线与分类分组边界

明细表格 SHALL 在列与列之间显示分隔线；每一分类分组之间的分割线 SHALL 明显可见。

### Scenario: 列竖线

- WHEN 明细表格渲染
- THEN 每个数据单元格 SHALL 有右侧分隔线（`1px var(--line)`）
- THEN 表格最右侧列 SHALL 无多余右分隔线

### Scenario: 分类分组边界加粗

- WHEN 明细表格按分类分组渲染（rowSpan 合并）
- THEN 每个分类分组的第一行 SHALL 显示加粗顶部分隔线（2px）
- THEN 分组边界线的颜色 SHALL 明显深于普通行分隔线
- THEN 只有一个分组时，首行 SHALL 同样显示加粗顶线
- THEN 明暗主题下 SHALL 均清晰可见

## Requirement: 分类总结栏

明细表格上方 SHALL 显示分类总结栏，逐分类展示分类名、商品种数、分类金额，末尾展示订单总计金额。

### Scenario: 总结栏内容

- WHEN 用户查看含明细的订单
- THEN 总结栏 SHALL 为每个分类显示一个块：分类名 + 商品种数（去重计数）+ 分类金额
- THEN 总结栏末尾 SHALL 显示「共计」块，值为所有明细 lineTotal 之和（grandTotal）
- THEN 商品种数 SHALL 为该分类下不同商品（commodityId）的去重数量
- THEN 分类金额 SHALL 为该分类下所有明细 lineTotal 之和

### Scenario: 总结栏样式

- THEN 分类块 SHALL 为白底、圆角、细边框 chip 样式，三段信息以「·」分隔
- THEN 分类金额 SHALL 以 accent 色、600 字重、等宽数字显示
- THEN 「共计」块 SHALL 以 accent 实底白字显示，为总结栏视觉锚点
- THEN 多个分类时 SHALL 横向排列、自动换行
- THEN 明细为空时总结栏 SHALL 隐藏

## Requirement: 明暗主题适配

总结栏与分隔线样式 SHALL 在明暗主题下均清晰可读。

### Scenario: 主题切换

- WHEN 切换深色主题
- THEN 列分隔线 SHALL 使用深色 `--line` 值
- THEN 分组边界线 SHALL 使用深色主题专用色（`#3f4a5f`）
- THEN 分类 chip 背景 SHALL 适配深色表面
- THEN 「共计」块 SHALL 保持 accent 实底白字，对比度足够
