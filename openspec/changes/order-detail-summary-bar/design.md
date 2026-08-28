# Design: order-detail-summary-bar

## 1. 布局结构（明细卡片 body 内自上而下）

```
┌────────────────────────────────────────────────────────┐
│ 明细列表                          ← 标题独立一行（level=5 标题）│
│ [导出 Excel] [添加明细]          ← 操作按钮右对齐（标题下一行）│
│ ── 分类总结栏 ──────────────────────────────────        │
│ [蔬菜·3种·¥56.50] [水果·2种·¥30.00]  共计 ¥101.50       │
│ ── 明细表格 ──────────────────────────────────          │
│ 表头：分类 名称 数量 单位 单价 金额 备注 分类金额 操作     │
│  ┌蔬菜┐ xxxxx │ x │ x │ x │ x │ 备注 │ ¥56.50 │ 编辑 删除 │
│  │蔬菜┐ xxxxx │ x │ x │ x │ x │ 备注 │        │          │
│  ╞═════╪══════╪═══╪═══╪═══╪═══╪══════╪════════╪══════════╡  ← 加粗分组线
│  ┌水果┐ xxxxx │ x │ x │ x │ x │ 备注 │ ¥30.00 │ 编辑 删除 │
│  ...
└────────────────────────────────────────────────────────┘
```

## 2. 明细列表标题独立成行

- 现状：标题「明细列表 共 x 项」与按钮在同一行（flex space-between）
- 改后：标题行（`Typography.Title level={5}`，「明细列表」+「共 x 项」次要文字）单独一行；下一行右侧放「导出 Excel」「添加明细」按钮
- 卡片 body 顶部两行间距 8px，按钮行与总结栏间距 12px

## 3. 表格列分隔线与分组边界

**列竖线**（CSS，index.css 新增 `.order-detail-table` 作用域）：

```css
.order-detail-table .ant-table-cell { border-right: 1px solid var(--line); }
.order-detail-table .ant-table-cell:last-child { border-right: 0; }
```

**分组边界加粗**：通过 `onRow` 给每个分组的首行标记 `group-start`：

```tsx
onRow={(record) => ({ className: groupMeta(record).rowSpan > 0 ? 'group-start' : '' })}
```

CSS：

```css
.order-detail-table .ant-table-tbody > tr.group-start > td {
  border-top: 2px solid #94a3b8 !important;   /* 比行分隔线深，突出大类边界 */
}
[data-theme='dark'] .order-detail-table .ant-table-tbody > tr.group-start > td {
  border-top-color: #3f4a5f;
}
```

> 说明：分类列 rowSpan 合并后，每个分组的首行就是该分类的起始行，整行加粗顶边框即形成「大类之间的明显分割线」，且不破坏 rowSpan 合并。

## 4. 分类总结栏（frontend-design 优化）

**信息模型**：`groups`（已有 `groupItems` 输出）逐分类生成块：`分类名 · 商品种数 · 分类金额`；末尾 `共计总金额`。商品种数 = 该分类下不同 commodityId 去重计数。

**设计语言**（沿用项目 token：`--accent: #3b82f6` / `--surface` / `--line` / `--muted` / tabular-nums）：

- 容器：`flex wrap`，gap 8，与表格之间留 12px
- 分类块（chip）：
  - 白底 `--surface`，1px `--line` 边框，圆角 8px，padding `4px 10px`
  - 内容三段：**分类名**（500 字重）· **x种**（--muted，12px）· **¥金额**（600 字重，tabular-nums，accent 色）
  - 段间用 · 分隔，整体紧凑
- 共计块（signature 元素）：
  - `--accent` 实底、白字、圆角 8px，padding `4px 12px`，600 字重，tabular-nums
  - 置于最右，视觉锚点；暗黑主题下用 accent 色微调亮度保持对比
- 空明细时不渲染总结栏

**样式草案**：

```css
.summary-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.summary-chip {
  display: inline-flex; align-items: baseline; gap: 6px;
  padding: 4px 10px; background: var(--surface);
  border: 1px solid var(--line); border-radius: 8px;
  font-size: 13px;
}
.summary-chip .chip-name { font-weight: 500; }
.summary-chip .chip-count { color: var(--muted); font-size: 12px; }
.summary-chip .chip-amount { font-weight: 600; color: var(--accent); font-variant-numeric: tabular-nums; }
.summary-total {
  padding: 4px 12px; background: var(--accent); color: #fff;
  border-radius: 8px; font-weight: 600; font-variant-numeric: tabular-nums;
}
[data-theme='dark'] .summary-chip { background: #1f1f1f; }
```

## 5. 明暗主题

- 列竖线用 `var(--line)`（两主题自动适配）
- 分组粗线亮色 `#94a3b8`、暗色 `#3f4a5f`（显式覆盖）
- 总结栏 chip 亮色 `--surface`、暗色 `#1f1f1f`；共计块两主题均 accent 实底白字
