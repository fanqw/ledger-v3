# Proposal: order-detail-refine

## Summary

订单详情页第二轮精修，5 项调整：

1. **返回按钮移到面包屑行**：返回按钮从「上卡片 extra」移到**面包屑同行最右侧**，去掉图标（纯文本「返回」）
2. **Descriptions 布局**：备注单独占一行（span=3）；进货金额前加 `¥` 单位
3. **明细表格滚动修复**：滚动条滚不到底、表格下边距缺失——改用**动态测量**表格容器高度（ResizeObserver）设置 `scroll.y`，替代硬编码 `calc(100vh - 455px)`
4. **明细头部精简**：移除标题旁的「共 x 项」；「导出 Excel / 添加明细」按钮置于明细卡片头部**最右侧**（与标题同行）
5. **总结栏一体化**：去掉割裂的独立 chip + 实底块，改为**整体横条**（容器 + 段间竖分隔线 + 右端「共计」文字强调）

纯前端改动：`apps/web/src/pages/OrderDetail.tsx`、`apps/web/src/components/layout/AppShell.tsx`、`apps/web/src/index.css`。

## Motivation

- 返回按钮藏在卡片右上角不易发现，且与面包屑导航重复；面包屑行右侧有空白，正好承载返回动作
- 备注在 Descriptions 中与其他字段挤在一行，长备注显示不全；金额无单位不够直观
- `scroll.y` 硬编码随布局变化（新增总结栏/标题）而失效，表格底部内容被截断
- 标题旁「共 x 项」冗余（总结栏已有商品种数）；按钮独占一行浪费垂直空间
- 总结栏独立 chip + 实底块在视觉上呈离散碎片，与表格/卡片割裂

## Scope

### In Scope
- AppShell 面包屑行支持右侧插槽（`breadcrumbExtra`），订单详情注册「返回」按钮
- Descriptions：备注 span=3 单独成行，进货金额 `¥` 前缀
- 明细表格动态滚动高度 + 底部留白
- 明细头部：移除共 x 项，标题与操作按钮同行（space-between）
- 总结栏改为整体横条样式（亮/暗主题）

### Out of Scope
- 后端/数据层改动
- 其他页面返回按钮
- 移动端布局

## Glossary
- 面包屑行插槽：AppShell 渲染面包屑的行，右侧可注入页面级 ReactNode
- 总结横条：一个整体容器，内部按分类分段、段间竖线分隔、右端总计强调的汇总样式
