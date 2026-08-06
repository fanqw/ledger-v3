import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { CreatableSelect } from '../components/ui/creatable-select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { toast } from '../lib/toast';
import { authFetch } from '../lib/api';
import { ArrowLeft, Plus, Pencil, Trash2, Download } from 'lucide-react';
import ExcelJS from 'exceljs';

// ==================== Types ====================

interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }
interface Commodity { id: string; name: string; category: Category; unit: Unit; }
interface PurchasePlace { id: string; place: string; marketName: string; }
interface OrderItem {
  id: string; commodityId: string; commodity: Commodity;
  quantity: number; unitPrice: number; lineTotal: number;
  computedLineTotal: number; isModified: boolean; description: string | null;
}
interface Order {
  id: string; name: string; description: string | null;
  purchasePlaceId: string | null; purchasePlace: PurchasePlace | null;
  items: OrderItem[]; createdAt: string; updatedAt: string;
}
interface ItemGroup { categoryId: string; categoryName: string; items: OrderItem[]; subtotal: number; }

// ==================== Helpers ====================

function fmt(v: number): string { return Number.isFinite(v) ? v.toFixed(2) : '0.00'; }
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
  if (order.purchasePlace) parts.push(`进货地: ${order.purchasePlace.place} - ${order.purchasePlace.marketName}`);
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
  // 记住哪些明细的 lineTotal 曾被手动修改过（客户端标记，用于表格标红）
  const [manualLineTotalItems, setManualLineTotalItems] = useState<Set<string>>(new Set());

  // preloaded refs — loaded once when dialog opens
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // delete item / order edit
  const [deleteItemTarget, setDeleteItemTarget] = useState<OrderItem | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({ name: '', description: '', purchasePlaceId: '' });
  const [orderSaving, setOrderSaving] = useState(false);
  const [purchasePlaces, setPurchasePlaces] = useState<PurchasePlace[]>([]);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/orders/${id}`); const json = await res.json();
      if (json.success) setOrder(json.data); else toast.error(json.error?.message || '加载失败');
    } catch { toast.error('加载订单失败'); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // 页面级预加载下拉数据，确保 onChange 始终能查到
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
        // 反向修改单价 = lineTotal / quantity
        if (isManual) return { ...f, lineTotal: v, unitPrice: String(round2(lt / qty)) };
      }
      return { ...f, lineTotal: v };
    });
  };

  // Stable fetch callbacks for CreatableSelect
  const fetchCommodities = useCallback(async (keyword: string) => {
    const res = await authFetch(`/api/commodities?page=1&pageSize=100&keyword=${encodeURIComponent(keyword)}`);
    const json = await res.json();
    return json.success ? json.data.items.map((c: Commodity) => ({ id: c.id, name: c.name })) : [];
  }, []);

  const fetchCategories = useCallback(async (keyword: string) => {
    const res = await authFetch(`/api/categories?page=1&pageSize=100&keyword=${encodeURIComponent(keyword)}`);
    const json = await res.json();
    return json.success ? json.data.items.map((c: Category) => ({ id: c.id, name: c.name })) : [];
  }, []);

  const fetchUnits = useCallback(async (keyword: string) => {
    const res = await authFetch(`/api/units?page=1&pageSize=100&keyword=${encodeURIComponent(keyword)}`);
    const json = await res.json();
    return json.success ? json.data.items.map((u: Unit) => ({ id: u.id, name: u.name })) : [];
  }, []);

  const createCommodity = useCallback(async (name: string) => {
    setItemForm(f => ({ ...f, commodityName: name, commodityId: '' }));
    return { id: '', name };
  }, []);

  const createCategory = useCallback(async (name: string) => {
    setItemForm(f => ({ ...f, categoryName: name, categoryId: '' }));
    return { id: '', name };
  }, []);

  const createUnit = useCallback(async (name: string) => {
    setItemForm(f => ({ ...f, unitName: name, unitId: '' }));
    return { id: '', name };
  }, []);

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
    const qty = Number(itemForm.quantity); const price = Number(itemForm.unitPrice); const lt = Number(itemForm.lineTotal);
    if (!qty || qty <= 0) { toast.error('数量必须大于0'); return; }
    if (isNaN(price) || price < 0) { toast.error('单价不能为负'); return; }
    if (isNaN(lt) || lt < 0) { toast.error('金额不能为负'); return; }
    if (!editingItem && !itemForm.commodityId && !itemForm.commodityName.trim()) { toast.error('请选择或输入商品'); return; }
    // 即输即建时确认 commodityName 非空
    if (!editingItem && (!itemForm.commodityId || itemForm.commodityId.startsWith('__')) && !itemForm.commodityName.trim()) { toast.error('请输入商品名称'); return; }
    // 即输即建时必须选择分类和单位（与商品基础资料页一致）
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
          // 本次保存金额为手动修改 → 标红
          setManualLineTotalItems(prev => new Set(prev).add(json.data.id));
        } else {
          // 本次保存金额为自动计算（修改数量/单价后联动）→ 清除标红
          setManualLineTotalItems(prev => {
            if (!prev.has(json.data.id)) return prev;
            const next = new Set(prev);
            next.delete(json.data.id);
            return next;
          });
        }
        setItemDialogOpen(false); fetchOrder(); }
      else { toast.error(json.error?.message || '操作失败'); }
    } catch { toast.error('操作失败'); } finally { setItemSaving(false); }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return;
    try {
      const res = await authFetch(`/api/orders/${id}/items/${deleteItemTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('删除成功'); setManualLineTotalItems(prev => { if (!prev.has(deleteItemTarget.id)) return prev; const next = new Set(prev); next.delete(deleteItemTarget.id); return next; }); fetchOrder(); } else { toast.error(json.error?.message || '删除失败'); }
    } catch { toast.error('删除失败'); } finally { setDeleteItemTarget(null); }
  };

  const openOrderEdit = () => {
    if (!order) return;
    setOrderForm({ name: order.name, description: order.description || '', purchasePlaceId: order.purchasePlaceId || '' });
    setPurchasePlaces([]);
    authFetch('/api/purchase-places?page=1&pageSize=100')
      .then(r => r.json())
      .then(j => { if (j.success) setPurchasePlaces(j.data.items); })
      .catch(() => toast.error('进货地加载失败'));
    setOrderDialogOpen(true);
  };

  const handleSaveOrder = async () => {
    if (!orderForm.name.trim()) { toast.error('订单名称不能为空'); return; }
    setOrderSaving(true);
    try {
      const res = await authFetch(`/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: orderForm.name.trim(), description: orderForm.description.trim() || undefined, purchasePlaceId: orderForm.purchasePlaceId || null }) });
      const json = await res.json();
      if (json.success) { toast.success('更新成功'); setOrderDialogOpen(false); fetchOrder(); } else { toast.error(json.error?.message || '操作失败'); }
    } catch { toast.error('操作失败'); } finally { setOrderSaving(false); }
  };

  // ============ Render ============

  if (loading) return <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
  if (!order) return <div className="flex flex-col items-center justify-center py-16"><p className="text-[#64748B]">订单不存在</p><Button variant="outline" className="mt-4" onClick={() => navigate('/orders')}>返回列表</Button></div>;

  // 合并后端 isModified 和客户端手动修改标记
  const displayItems = order.items.map(item => ({
    ...item,
    isModified: item.isModified || manualLineTotalItems.has(item.id),
  }));
  const groups = groupItems(displayItems);
  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const totalRows = displayItems.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="default" className="h-8 w-8 p-0" onClick={() => navigate('/orders')}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-[18px] font-bold text-[#0F172A] dark:text-white">{order.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="default" onClick={openOrderEdit}><Pencil className="mr-1 h-4 w-4" /> 编辑</Button>
          <Button variant="outline" size="default" onClick={() => exportToExcel(order)}><Download className="mr-1 h-4 w-4" /> 导出 Excel</Button>
        </div>
      </div>
      <div className="flex gap-6 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
        {order.purchasePlace && <span>进货地: {order.purchasePlace.place} - {order.purchasePlace.marketName}</span>}
        <span>创建时间: {fmtDate(order.createdAt)}</span>
        {order.description && <span>备注: {order.description}</span>}
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[#0F172A] dark:text-white">明细列表</h2>
        <Button onClick={openAddItem} className="bg-[#3B82F6] hover:bg-[#3B82F6]/90"><Plus className="mr-1 h-4 w-4" /> 添加明细</Button>
      </div>
      {order.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-[#E2E8F0] py-12 dark:border-[#334155]"><p className="text-[14px] text-[#94A3B8]">暂无明细</p></div>
      ) : (
        <div className="rounded-md border border-[#E2E8F0] dark:border-[#334155]">
          <Table>
            <TableHeader><TableRow><TableHead>分类</TableHead><TableHead>名称</TableHead><TableHead>数量</TableHead><TableHead>单位</TableHead><TableHead>单价</TableHead><TableHead>金额</TableHead><TableHead>备注</TableHead><TableHead>分类金额</TableHead><TableHead>总金额</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {groups.map((g, gi) => g.items.map((item, ii) => {
                const isFirst = ii === 0; const isGlobalFirst = gi === 0 && ii === 0;
                return (
                  <TableRow key={item.id}>
                    {isFirst ? <TableCell rowSpan={g.items.length} className="align-top font-medium">{g.categoryName}</TableCell> : null}
                    <TableCell>{item.commodity?.name || '-'}</TableCell><TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.commodity?.unit?.name || '-'}</TableCell><TableCell>{fmt(item.unitPrice)}</TableCell>
                    <TableCell className={item.isModified ? 'font-medium text-red-600' : ''}>{fmt(item.lineTotal)}</TableCell>
                    <TableCell className="max-w-[120px] truncate">{item.description || '-'}</TableCell>
                    {isFirst ? <TableCell rowSpan={g.items.length} className="align-top font-medium">{fmt(g.subtotal)}</TableCell> : null}
                    {isGlobalFirst ? <TableCell rowSpan={totalRows} className="align-top font-bold text-[15px]">{fmt(grandTotal)}</TableCell> : null}
                    <TableCell><div className="flex items-center gap-1"><Button variant="ghost" size="default" className="h-8 w-8 p-0" onClick={() => openEditItem(item)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="default" className="h-8 w-8 p-0 text-red-500" onClick={() => setDeleteItemTarget(item)}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                  </TableRow>
                );
              }))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingItem ? '编辑明细' : '添加明细'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* 商品 — 仅 CreatableSelect，无额外 Input */}
            {!editingItem && (
              <div>
                <label className="text-sm font-medium">商品 *</label>
                <CreatableSelect
                  value={itemForm.commodityId || null}
                  onChange={(newId) => {
                    const match = commodities.find(c => c.id === newId);
                    setItemForm(f => ({
                      ...f, commodityId: newId, commodityName: match ? '' : f.commodityName,
                      categoryId: match?.category?.id || (newId.startsWith('__') ? f.categoryId : ''),
                      unitId: match?.unit?.id || (newId.startsWith('__') ? f.unitId : ''),
                    }));
                  }}
                  fetchItems={fetchCommodities}
                  createItem={createCommodity}
                  placeholder="搜索选择商品..."
                />
              </div>
            )}

            {/* 分类 — 仅 CreatableSelect */}
            <div>
              <label className="text-sm font-medium">分类</label>
              <CreatableSelect
                value={itemForm.categoryId || null}
                onChange={(newId) => setItemForm(f => ({ ...f, categoryId: newId, categoryName: newId.startsWith('__') ? f.categoryName : '' }))}
                fetchItems={fetchCategories}
                createItem={createCategory}
                placeholder="搜索选择分类..."
              />
            </div>

            {/* 单位 — 仅 CreatableSelect */}
            <div>
              <label className="text-sm font-medium">单位</label>
              <CreatableSelect
                value={itemForm.unitId || null}
                onChange={(newId) => setItemForm(f => ({ ...f, unitId: newId, unitName: newId.startsWith('__') ? f.unitName : '' }))}
                fetchItems={fetchUnits}
                createItem={createUnit}
                placeholder="搜索选择单位..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">数量 *</label><Input type="number" min="0" step="0.001" value={itemForm.quantity} onChange={(e) => handleQtyChange(e.target.value)} placeholder="0" /></div>
              <div><label className="text-sm font-medium">单价 *</label><Input type="number" min="0" step="0.01" value={itemForm.unitPrice} onChange={(e) => handlePriceChange(e.target.value)} placeholder="0.00" /></div>
            </div>
            <div>
              <label className="text-sm font-medium">金额 *</label>
              <Input type="number" min="0" step="0.01" value={itemForm.lineTotal} onChange={(e) => handleLineTotalChange(e.target.value)} className={lineTotalManuallySet ? 'text-red-600 border-red-400' : ''} placeholder="自动计算" />
            </div>
            <div><label className="text-sm font-medium">备注</label><Input value={itemForm.description} onChange={(e) => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="输入备注（可选）" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setItemDialogOpen(false)}>取消</Button><Button onClick={handleSaveItem} disabled={itemSaving}>{itemSaving ? '保存中...' : '保存'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItemTarget} onOpenChange={() => setDeleteItemTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确定删除明细 "{deleteItemTarget?.commodity?.name}"？</AlertDialogTitle><AlertDialogDescription>此操作不可恢复。</AlertDialogDescription></AlertDialogHeader>
          <div className="flex justify-end gap-2"><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-700">删除</AlertDialogAction></div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>编辑订单</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">名称 *</label><Input value={orderForm.name} onChange={(e) => setOrderForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-sm font-medium">进货地</label>
              <Select value={orderForm.purchasePlaceId || 'none'} onValueChange={(v) => setOrderForm(f => ({ ...f, purchasePlaceId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="选择进货地（可选）" /></SelectTrigger>
                <SelectContent><SelectItem value="none">不选择</SelectItem>
                  {purchasePlaces.map((pp: PurchasePlace) => <SelectItem key={pp.id} value={pp.id}>{pp.place} - {pp.marketName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">备注</label><Input value={orderForm.description} onChange={(e) => setOrderForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOrderDialogOpen(false)}>取消</Button><Button onClick={handleSaveOrder} disabled={orderSaving}>{orderSaving ? '保存中...' : '保存'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
