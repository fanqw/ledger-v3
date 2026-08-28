# Design: order-detail-refine

## 1. 面包屑行插槽（AppShell.tsx）

面包屑行改为 flex 布局，左侧 Breadcrumb，右侧可注入页面级 ReactNode：

```tsx
// AppShell.tsx
const [breadcrumbExtra, setBreadcrumbExtra] = useState<ReactNode>(null);
// ...
<Content className="app-content">
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
    {breadcrumb.length > 0 && (
      <Breadcrumb items={breadcrumb.map((b) => ({ title: b }))} />
    )}
    <div style={{ flex: '0 0 auto' }}>{breadcrumbExtra}</div>
  </div>
  <Outlet context={{ setBreadcrumbExtra }} />
</Content>
```

- 面包屑为空时左侧不渲染（保持右对齐由 flex 自动处理）
- 通过 `Outlet context` 把 setter 传给子路由，避免全局 context 侵入

**订单详情注册返回按钮**（OrderDetail.tsx）：

```tsx
const { setBreadcrumbExtra } = useOutletContext<{
  setBreadcrumbExtra?: (node: ReactNode | null) => void;
}>();

useEffect(() => {
  setBreadcrumbExtra?.(
    <Button type="text" size="small" onClick={() => navigate('/orders')}>返回</Button>
  );
  return () => setBreadcrumbExtra?.(null);
}, [setBreadcrumbExtra, navigate]);
```

- 纯文本「返回」，无图标；点击回 `/orders`
- 组件卸载时清理插槽，避免残留到其他页面

## 2. Descriptions（OrderDetail.tsx）

```tsx
<Descriptions column={3} size="small">
  <Descriptions.Item label="进货地">{order.market?.city?.place || '-'}</Descriptions.Item>
  <Descriptions.Item label="进货市场">{order.market?.name || '-'}</Descriptions.Item>
  <Descriptions.Item label="进货金额">¥{fmt(grandTotal)}</Descriptions.Item>
  <Descriptions.Item label="创建时间">{fmtDate(order.createdAt)}</Descriptions.Item>
  <Descriptions.Item label="修改时间">{fmtDate(order.updatedAt)}</Descriptions.Item>
  <Descriptions.Item label="备注" span={3}>{order.description || '-'}</Descriptions.Item>
</Descriptions>
```

- 备注 `span={3}` 独占整行
- 进货金额 `¥` 前缀（`fmt` 已保证不强制保留尾 0）

## 3. 明细表格滚动修复（OrderDetail.tsx）

**问题**：`scroll.y = 'calc(100vh - 455px)'` 硬编码，布局变化（标题/总结栏高度浮动）时失效，表格底部被截断。

**方案**：动态测量明细卡片 body 中表格容器的高度：

```tsx
const tableWrapRef = useRef<HTMLDivElement>(null);
const [tableScrollY, setTableScrollY] = useState<number>(0);

useLayoutEffect(() => {
  const el = tableWrapRef.current;
  if (!el) return;
  const update = () => {
    const h = el.clientHeight;
    // 表头约 55px（antd middle size），滚动区高度 = 容器高 - 表头 - 预留下边距
    setTableScrollY(Math.max(120, h - 55 - 12));
  };
  update();
  const ro = new ResizeObserver(update);
  ro.observe(el);
  return () => ro.disconnect();
}, [displayItems.length]);
```

渲染：

```tsx
<div ref={tableWrapRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
  <Table ... scroll={{ x: 1040, y: tableScrollY }} />
</div>
```

- `flex: 1; minHeight: 0` 让容器占满 body 剩余空间
- ResizeObserver 监听容器尺寸，窗口/布局变化时自动重算
- 底部预留 12px 下边距，保证最后一行完整可见

## 4. 明细头部精简（OrderDetail.tsx）

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
  <Typography.Title level={5} style={{ margin: 0 }}>明细列表</Typography.Title>
  <Space>
    <Button icon={<DownloadOutlined />} onClick={() => exportToExcel(order)}>导出 Excel</Button>
    <Button type="primary" icon={<PlusOutlined />} onClick={openAddItem}>添加明细</Button>
  </Space>
</div>
```

- 标题与按钮同行：左侧「明细列表」，右侧「导出/添加」
- 移除「共 x 项」
- 总结栏紧跟其下（margin-bottom 12）

## 5. 总结栏两层结构（index.css + OrderDetail.tsx）

**问题**：独立 chip + 实底「共计」块视觉割裂；单行横条在分类多时被压缩。

**方案**：两层结构 `order-summary`——上层分类区、下层总计区，与明细表格形成连续边界（上圆角 + 表格下圆角拼接）：

```tsx
<section className="order-summary" aria-label="明细分类汇总">
  <div className="order-summary__categories">
    {groups.map((group) => (
      <div className="order-summary__category" key={group.categoryId}>
        <span className="order-summary__name">{group.categoryName}</span>
        <span className="order-summary__count">
          {new Set(group.items.map((item) => item.commodityId)).size} 种
        </span>
        <span className="order-summary__amount">¥{fmt(group.subtotal)}</span>
      </div>
    ))}
  </div>
  <div className="order-summary__overview">
    <span className="order-summary__scale">
      共 {groups.length} 个分类 · {displayItems.length} 项明细
    </span>
    <strong className="order-summary__total">总计 ¥{fmt(grandTotal)}</strong>
  </div>
</section>
```

CSS 要点：

```css
.order-summary {
  flex: 0 0 auto; overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line); border-bottom: 0;
  border-radius: 8px 8px 0 0;                 /* 上与表格拼连续边界 */
}
.order-summary__categories {
  display: flex; align-items: stretch; flex-wrap: wrap; padding: 4px 8px;
}
.order-summary__category {
  display: flex; align-items: baseline; gap: 7px; padding: 9px 12px;
  border-right: 1px solid var(--line);
}
.order-summary__category:last-child { border-right: 0; }
.order-summary__name { color: var(--text); font-weight: 600; }
.order-summary__count { color: var(--muted); font-size: 12px; }
.order-summary__amount { color: var(--accent); font-weight: 650; font-variant-numeric: tabular-nums; }
.order-summary__overview {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  min-height: 44px; padding: 10px 20px; color: var(--muted);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  border-top: 1px solid var(--line);
}
.order-summary__scale { font-size: 13px; }
.order-summary__total { color: var(--accent); font-size: 16px; font-variant-numeric: tabular-nums; }
.order-detail-table-wrap .ant-table-container { border-radius: 0 0 8px 8px; }
[data-theme='dark'] .order-summary__overview { background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
```

- 上层分类区：分类段用**竖线**分隔、自动换行，全量展示所有分类（不压缩）
- 下层总计区：左「共 x 个分类 · x 项明细」规模文案，右「总计 ¥」accent 大字
- 与表格容器形成上下连续边框，视觉上「总结栏 + 明细表」是一整块
- 移动端（≤479px）：分类段纵向堆叠、总计区改列向
