import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Button, Input, InputNumber, Modal, Select, AutoComplete, Space, Card, Descriptions, App as AntdApp, Typography, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import { toast } from '../lib/toast';
import { authFetch } from '../lib/api';
import ExcelJS from 'exceljs';

// ==================== Types ====================

interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }
interface Commodity { id: string; name: string; category: Category; unit: Unit; }
interface Market { id: string; name: string; city?: { id: string; place: string } | null; }
interface OrderItem {
  id: string; commodityId: string; commodity: Commodity;
  quantity: number; unitPrice: number; lineTotal: number;
  computedLineTotal: number; isModified: boolean; description: string | null;
}
interface Order {
  id: string; name: string; description: string | null;
  marketId: string | null; market: Market | null;
  items: OrderItem[]; createdAt: string; updatedAt: string;
}
interface ItemGroup { categoryId: string; categoryName: string; items: OrderItem[]; subtotal: number; }

// ==================== Helpers ====================

function fmt(v: number): string { return Number.isFinite(v) ? String(Number(v.toFixed(4))) : '0'; }
function fmtDate(s: string): string { return new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function round2(v: number): number { return Math.round(v * 100) / 100; }

function groupItems(items: OrderItem[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const item of items) {
    const cn = item.commodity?.category?.name || '未分类';
    const ci = item.commodity?.category?.id || '__none__';
    if (!map.has(ci)) map.set(ci, { categoryId: ci, categoryName: cn, items: [], subtotal: 0 });
    const g = map.get(ci)!;
    g.items.push(item);
    g.subtotal += item.lineTotal;
  }
  return Array.from(map.values());
}

function border(c: { top?: string; bottom?: string; left?: string; right?: string }) {
  const s = (v: string | undefined) => ({ style: (v || 'thin') as 'thin' | 'double' });
  return { top: s(c.top), bottom: s(c.bottom), left: s(c.left), right: s(c.right) };
}

async function exportToExcel(order: Order) {
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet(order.name);
  const center = { horizontal: 'center', vertical: 'middle' } as const;
  s.mergeCells('A1:I1'); const t = s.getCell('A1'); t.value = `订单: ${order.name}`; t.font = { bold: true, size: 14 }; t.alignment = center;
  s.mergeCells('A2:I2'); const parts: string[] = [];
  if (order.market) parts.push(`进货市场: ${order.market.name} (${order.market.city?.place ?? ''})`);
  parts.push(`创建时间: ${fmtDate(order.createdAt)}`); s.getCell('A2').value = parts.join('    '); s.getCell('A2').alignment = center;
  const hdrs = ['分类', '名称', '数量', '单位', '单价', '金额', '备注', '分类金额', '总金额'];
  const hr = s.getRow(4);
  hdrs.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; c.border = border({}); c.alignment = center; });
  const groups = groupItems(order.items); const gt = groups.reduce((sum, g) => sum + g.subtotal, 0); let ri = 5;
  for (const g of groups) {
    for (let i = 0; i < g.items.length; i++) {
      const item = g.items[i]; const r = s.getRow(ri);
      if (i === 0) { r.getCell(1).value = g.categoryName; if (g.items.length > 1) s.mergeCells(ri, 1, ri + g.items.length - 1, 1); }
      r.getCell(2).value = item.commodity?.name || ''; r.getCell(3).value = item.quantity;
      r.getCell(4).value = item.commodity?.unit?.name || ''; r.getCell(5).value = item.unitPrice;
      r.getCell(6).value = item.lineTotal; r.getCell(7).value = item.description || '';
      if (i === 0) { r.getCell(8).value = g.subtotal; if (g.items.length > 1) s.mergeCells(ri, 8, ri + g.items.length - 1, 8); }
      if (ri === 5) { r.getCell(9).value = gt; if (order.items.length > 1) s.mergeCells(ri, 9, ri + order.items.length - 1, 9); }
      if (item.isModified) { r.getCell(6).font = { color: { argb: 'FFDC2626' } }; r.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; }
      for (let c = 1; c <= 9; c++) { r.getCell(c).border = border({}); r.getCell(c).alignment = center; }
      ri++;
    }
  }
  const tr = s.getRow(ri); s.mergeCells(ri, 1, ri, 7);
  tr.getCell(1).value = '总计'; tr.getCell(1).font = { bold: true }; tr.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
  tr.getCell(8).value = gt; tr.getCell(8).font = { bold: true, size: 12 }; tr.getCell(8).alignment = center;
  for (let c = 1; c <= 9; c++) tr.getCell(c).border = border({ top: 'double' });
  s.getColumn(1).width = 10; s.getColumn(2).width = 16; s.getColumn(3).width = 8; s.getColumn(4).width = 8;
  s.getColumn(5).width = 10; s.getColumn(6).width = 10; s.getColumn(7).width = 16; s.getColumn(8).width = 12; s.getColumn(9).width = 12;
  const buf = await wb.xlsx.writeBuffer(); const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
  a.download = `${order.name}_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url);
}

// ==================== Component ====================

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>(); const navigate = useNavigate();
  const { modal } = AntdApp.useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [itemForm, setItemForm] = useState({
    commodityId: '', commodityName: '', categoryId: '', categoryName: '',
    unitId: '', unitName: '', quantity: '', unitPrice: '', lineTotal: '', description: '',
  });
  const [lineTotalManuallySet, setLineTotalManuallySet] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [manualLineTotalItems, setManualLineTotalItems] = useState<Set<string>>(new Set());

  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [deleteItemTarget, setDeleteItemTarget] = useState<OrderItem | null>(null);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/orders/${id}`); const json = await res.json();
      if (json.success) setOrder(json.data); else toast.error(json.error?.message || '加载失败');
    } catch { toast.error('加载订单失败'); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cr, catR, unitR] = await Promise.all([
          authFetch('/api/commodities?page=1&pageSize=100'),
          authFetch('/api/categories?page=1&pageSize=100'),
          authFetch('/api/units?page=1&pageSize=100'),
        ]);
        const [cj, catJ, unitJ] = await Promise.all([cr.json(), catR.json(), unitR.json()]);
        if (cj.success) setCommodities(cj.data.items);
        if (catJ.success) setCategories(catJ.data.items);
        if (unitJ.success) setUnits(unitJ.data.items);
      } catch { /* 非关键数据，静默处理 */ }
    };
    load();
  }, [id]);

  // ============ LineTotal（纯函数 + 函数式更新）============

  const handleQtyChange = (v: string) => {
    const qty = Number(v);
    setItemForm(f => {
      if (qty > 0 && Number(f.unitPrice) >= 0) {
        setLineTotalManuallySet(false);
        return { ...f, quantity: v, lineTotal: String(round2(qty * Number(f.unitPrice))) };
      }
      return { ...f, quantity: v };
    });
  };

  const handlePriceChange = (v: string) => {
    const price = Number(v);
    setItemForm(f => {
      if (Number(f.quantity) > 0 && price >= 0) {
        setLineTotalManuallySet(false);
        return { ...f, unitPrice: v, lineTotal: String(round2(Number(f.quantity) * price)) };
      }
      return { ...f, unitPrice: v };
    });
  };

  const handleLineTotalChange = (v: string) => {
    const lt = Number(v);
    setItemForm(f => {
      const qty = Number(f.quantity);
      if (qty > 0 && !isNaN(lt)) {
        const computed = round2(qty * Number(f.unitPrice));
        const isManual = Math.abs(lt - computed) > 0.005;
        setLineTotalManuallySet(isManual);
        if (isManual) return { ...f, lineTotal: v, unitPrice: String(round2(lt / qty)) };
      }
      return { ...f, lineTotal: v };
    });
  };

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({ commodityId: '', commodityName: '', categoryId: '', categoryName: '', unitId: '', unitName: '', quantity: '', unitPrice: '', lineTotal: '', description: '' });
    setLineTotalManuallySet(false);
    setItemDialogOpen(true);
  };

  const openEditItem = (item: OrderItem) => {
    setEditingItem(item);
    setItemForm({
      commodityId: item.commodityId, commodityName: '',
      categoryId: item.commodity?.category?.id || '', categoryName: '',
      unitId: item.commodity?.unit?.id || '', unitName: '',
      quantity: String(item.quantity), unitPrice: String(item.unitPrice),
      lineTotal: String(item.lineTotal), description: item.description || '',
    });
    setLineTotalManuallySet(item.isModified);
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (itemSaving) return;
    const qty = Number(itemForm.quantity); const price = Number(itemForm.unitPrice); const lt = Number(itemForm.lineTotal);
    if (!qty || qty <= 0) { toast.error('数量必须大于0'); return; }
    if (isNaN(price) || price < 0) { toast.error('单价不能为负'); return; }
    if (isNaN(lt) || lt < 0) { toast.error('金额不能为负'); return; }
    if (!editingItem && !itemForm.commodityId && !itemForm.commodityName.trim()) { toast.error('请选择或输入商品'); return; }
    if (!editingItem && (!itemForm.commodityId || itemForm.commodityId.startsWith('__')) && !itemForm.commodityName.trim()) { toast.error('请输入商品名称'); return; }
    if (!editingItem && (!itemForm.commodityId || itemForm.commodityId.startsWith('__'))) {
      const hasCat = !!(itemForm.categoryId && !itemForm.categoryId.startsWith('__')) || !!itemForm.categoryName.trim();
      const hasUnit = !!(itemForm.unitId && !itemForm.unitId.startsWith('__')) || !!itemForm.unitName.trim();
      if (!hasCat) { toast.error('即输即建商品时必须选择分类'); return; }
      if (!hasUnit) { toast.error('即输即建商品时必须选择单位'); return; }
    }

    setItemSaving(true);
    try {
      const url = editingItem ? `/api/orders/${id}/items/${editingItem.id}` : `/api/orders/${id}/items`;
      const method = editingItem ? 'PATCH' : 'POST';
      let body: Record<string, unknown>;
      if (editingItem) {
        body = { quantity: qty, unitPrice: price, lineTotal: lt, description: itemForm.description.trim() || undefined };
      } else if (!itemForm.commodityId || itemForm.commodityId.startsWith('__')) {
        body = { commodityName: itemForm.commodityName.trim(), categoryId: itemForm.categoryId && !itemForm.categoryId.startsWith('__') ? itemForm.categoryId : undefined, categoryName: itemForm.categoryName.trim() || undefined, unitId: itemForm.unitId && !itemForm.unitId.startsWith('__') ? itemForm.unitId : undefined, unitName: itemForm.unitName.trim() || undefined, quantity: qty, unitPrice: price, lineTotal: lt, description: itemForm.description.trim() || undefined };
      } else {
        body = { commodityId: itemForm.commodityId, quantity: qty, unitPrice: price, lineTotal: lt, description: itemForm.description.trim() || undefined };
      }
      const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        toast.success(editingItem ? '更新成功' : '添加成功');
        if (lineTotalManuallySet) {
          setManualLineTotalItems(prev => new Set(prev).add(json.data.id));
        } else {
          setManualLineTotalItems(prev => {
            if (!prev.has(json.data.id)) return prev;
            const next = new Set(prev);
            next.delete(json.data.id);
            return next;
          });
        }
        setItemDialogOpen(false); fetchOrder();
      } else { toast.error(json.error?.message || '操作失败'); }
    } catch { toast.error('操作失败'); } finally { setItemSaving(false); }
  };

  const handleDeleteItem = async (target: OrderItem) => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/orders/${id}/items/${target.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('删除成功');
        setManualLineTotalItems(prev => { if (!prev.has(target.id)) return prev; const next = new Set(prev); next.delete(target.id); return next; });
        fetchOrder();
      } else { toast.error(json.error?.message || '删除失败'); }
    } catch { toast.error('删除失败'); }
    finally { setDeleting(false); }
  };

  const confirmDeleteItem = (item: OrderItem) => {
    modal.confirm({
      title: `确定删除明细 "${item.commodity?.name}"？`,
      content: '此操作不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => handleDeleteItem(item),
    });
  };

  // ============ Render ============

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!order) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 64 }}>
        <Typography.Text type="secondary">订单不存在</Typography.Text>
        <Button onClick={() => navigate('/orders')}>返回列表</Button>
      </div>
    );
  }

  const displayItems = order.items.map(item => ({
    ...item,
    isModified: item.isModified || manualLineTotalItems.has(item.id),
  }));
  const groups = groupItems(displayItems);
  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0);

  // AutoComplete options
  const commodityOptions = commodities
    .filter(c => !c.name.includes('__'))
    .map(c => ({ value: c.name, id: c.id, categoryId: c.category?.id, unitId: c.unit?.id }));
  const categoryOptions = categories.map(c => ({ value: c.name, id: c.id }));
  const unitOptions = units.map(u => ({ value: u.name, id: u.id }));

  // 分类分组合并：组内第一行 rowSpan = 组内行数，其余 0（隐藏），实现纵向合并
  const groupMeta = (record: OrderItem) => {
    const g = groups.find(g => g.categoryId === (record.commodity?.category?.id || '__none__'));
    const idx = g ? g.items.findIndex(i => i.id === record.id) : 0;
    return { rowSpan: idx === 0 ? (g?.items.length || 0) : 0, g };
  };

  const columns: ColumnsType<OrderItem> = [
    {
      title: '分类',
      width: 90,
      fixed: 'left',
      onCell: (record) => ({ rowSpan: groupMeta(record).rowSpan }),
      render: (_, record) => record.commodity?.category?.name || '未分类',
    },
    { title: '名称', width: 160, fixed: 'left', render: (_, record) => record.commodity?.name || '-' },
    { title: '数量', render: (_, record) => record.quantity },
    { title: '单位', render: (_, record) => record.commodity?.unit?.name || '-' },
    { title: '单价', render: (_, record) => fmt(record.unitPrice) },
    {
      title: '金额',
      render: (_, record) => (
        <span style={record.isModified ? { color: '#f5222d', fontWeight: 500 } : undefined}>{fmt(record.lineTotal)}</span>
      ),
    },
    { title: '备注', dataIndex: 'description', render: (v) => v || '-' },
    {
      title: '分类金额',
      onCell: (record) => ({ rowSpan: groupMeta(record).rowSpan }),
      render: (_, record) => <span style={{ fontWeight: 500 }}>{fmt(groupMeta(record).g?.subtotal || 0)}</span>,
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => openEditItem(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => confirmDeleteItem(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 112px)', overflow: 'hidden' }}>
      {/* 上方：订单信息卡片（Descriptions 展示核心字段） */}
      <Card
        title={order.name}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>返回</Button>
        }
      >
        <Descriptions column={3} size="small">
          <Descriptions.Item label="进货地">{order.market?.city?.place || '-'}</Descriptions.Item>
          <Descriptions.Item label="进货市场">{order.market?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="进货金额">{fmt(grandTotal)}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{fmtDate(order.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="修改时间">{fmtDate(order.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="备注">{order.description || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 下方：明细列表卡片（无 header，标题/操作放 body 顶部） */}
      <Card
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
          <Space size={8}>
            <span style={{ fontWeight: 500 }}>明细列表</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>共 {displayItems.length} 项</Typography.Text>
          </Space>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={() => exportToExcel(order)}>导出 Excel</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddItem}>添加明细</Button>
          </Space>
        </div>
        {displayItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Typography.Text type="secondary">暂无明细</Typography.Text>
          </div>
        ) : (
          <Table<OrderItem>
            rowKey="id"
            columns={columns}
            dataSource={displayItems}
            pagination={false}
            size="middle"
            scroll={{ x: 1040, y: 'calc(100vh - 383px)' }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={9}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                      <b>总计</b>
                      <b style={{ fontSize: 15 }}>{fmt(grandTotal)}</b>
                    </div>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        )}
      </Card>

      {/* 明细弹窗 */}
      <Modal
        title={editingItem ? '编辑明细' : '添加明细'}
        open={itemDialogOpen}
        onOk={handleSaveItem}
        onCancel={() => setItemDialogOpen(false)}
        confirmLoading={itemSaving}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!editingItem && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>商品 *</label>
              <AutoComplete
                style={{ width: '100%' }}
                options={commodityOptions}
                value={itemForm.commodityName || (itemForm.commodityId ? commodityOptions.find(c => c.id === itemForm.commodityId)?.value : '')}
                onChange={(v) => setItemForm(f => ({ ...f, commodityName: v, commodityId: '' }))}
                onSelect={(_, opt) => setItemForm(f => ({
                  ...f, commodityName: '', commodityId: opt.id,
                  categoryId: opt.categoryId || f.categoryId, unitId: opt.unitId || f.unitId,
                }))}
                placeholder="搜索选择商品..."
                allowClear
              />
            </div>
          )}
          {!editingItem && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>分类</label>
              <AutoComplete
                style={{ width: '100%' }}
                options={categoryOptions}
                value={itemForm.categoryName || (itemForm.categoryId ? categoryOptions.find(c => c.id === itemForm.categoryId)?.value : '')}
                onChange={(v) => setItemForm(f => ({ ...f, categoryName: v, categoryId: '' }))}
                onSelect={(_, opt) => setItemForm(f => ({ ...f, categoryName: '', categoryId: opt.id }))}
                placeholder="搜索选择分类..."
                allowClear
              />
            </div>
          )}
          {!editingItem && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>单位</label>
              <AutoComplete
                style={{ width: '100%' }}
                options={unitOptions}
                value={itemForm.unitName || (itemForm.unitId ? unitOptions.find(u => u.id === itemForm.unitId)?.value : '')}
                onChange={(v) => setItemForm(f => ({ ...f, unitName: v, unitId: '' }))}
                onSelect={(_, opt) => setItemForm(f => ({ ...f, unitName: '', unitId: opt.id }))}
                placeholder="搜索选择单位..."
                allowClear
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>数量 *</label>
              <InputNumber
                style={{ width: '100%' }}
                min={0} step={0.001} value={itemForm.quantity ? Number(itemForm.quantity) : undefined}
                onChange={(v) => handleQtyChange(String(v ?? ''))} placeholder="0"
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>单价 *</label>
              <InputNumber
                style={{ width: '100%' }}
                min={0} step={0.01} value={itemForm.unitPrice ? Number(itemForm.unitPrice) : undefined}
                onChange={(v) => handlePriceChange(String(v ?? ''))} placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500 }}>金额 *</label>
            <InputNumber
              style={{ width: '100%' }}
              min={0} step={0.01} value={itemForm.lineTotal ? Number(itemForm.lineTotal) : undefined}
              onChange={(v) => handleLineTotalChange(String(v ?? ''))} placeholder="自动计算"
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500 }}>备注</label>
            <Input.TextArea rows={3} value={itemForm.description} onChange={(e) => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="输入备注（可选）" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
