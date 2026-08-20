import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DataTable, type Column, type PaginationInfo } from '../components/ui/data-table';
import { toast } from '../lib/toast';
import { authFetch } from '../lib/api';
import { fetchAllPages } from '../lib/paged-request';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';

interface PurchasePlace { id: string; place: string; marketName: string; }

interface Order {
  id: string;
  name: string;
  description: string | null;
  purchasePlaceId: string | null;
  purchasePlace: PurchasePlace | null;
  createdAt: string;
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, pageSize: 20, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState({ name: '', description: '', purchasePlaceId: '' });
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [purchasePlaces, setPurchasePlaces] = useState<PurchasePlace[]>([]);

  const fetchData = useCallback(async (page: number, kw: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (kw) params.set('keyword', kw);
      const res = await authFetch(`/api/orders?${params}`);
      const json = await res.json();
      if (json.success) { setData(json.data.items); setPagination(json.data.meta); }
      else { toast.error(json.error?.message || '加载失败'); }
    } catch { toast.error('加载订单失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const delay = keyword.trim() ? 300 : 0;
    const task = setTimeout(() => { void fetchData(1, keyword); }, delay);
    return () => clearTimeout(task);
  }, [keyword, fetchData]);

  const loadPurchasePlaces = async () => {
    try {
      const items = await fetchAllPages<PurchasePlace>(
        (page, pageSize) => authFetch(`/api/purchase-places?page=${page}&pageSize=${pageSize}`), 100,
      );
      setPurchasePlaces(items);
    } catch { toast.error('进货地加载失败'); }
  };

  const openCreate = async () => {
    setEditing(null);
    setForm({ name: '', description: '', purchasePlaceId: '' });
    loadPurchasePlaces();
    // 获取默认名称
    try {
      const res = await authFetch('/api/orders/next-name');
      const json = await res.json();
      if (json.success) setForm((f) => ({ ...f, name: json.data.name }));
    } catch { /* 默认名称获取失败不影响弹窗打开 */ }
    setDialogOpen(true);
  };

  const openEdit = (row: Order) => {
    setEditing(row);
    setForm({ name: row.name, description: row.description || '', purchasePlaceId: row.purchasePlaceId || '' });
    loadPurchasePlaces();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('订单名称不能为空'); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/orders/${editing.id}` : '/api/orders';
      const method = editing ? 'PATCH' : 'POST';
      const body: Record<string, string | null | undefined> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        // null 表示清空进货地；undefined 表示不修改
        purchasePlaceId: form.purchasePlaceId || null,
      };
      const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { toast.success(editing ? '更新成功' : '创建成功'); setDialogOpen(false); fetchData(pagination.page, keyword); }
      else { toast.error(json.error?.message || '操作失败'); }
    } catch { toast.error('操作失败'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await authFetch(`/api/orders/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('删除成功'); fetchData(pagination.page, keyword); }
      else { toast.error(json.error?.message || '删除失败'); }
    } catch { toast.error('删除失败'); }
    finally { setDeleteTarget(null); }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const columns: Column<Order>[] = [
    { key: 'name', label: '订单名称' },
    { key: 'purchasePlace', label: '进货地', render: (_, row) => row.purchasePlace ? `${row.purchasePlace.place} - ${row.purchasePlace.marketName}` : '-' },
    { key: 'description', label: '备注', render: (v) => (v as string) || '-' },
    { key: 'createdAt', label: '创建时间', render: (v) => formatDate(v as string) },
    { key: 'actions', label: '操作', width: '140px', render: (_, row) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="default" className="h-8 w-8 p-0" onClick={() => navigate(`/orders/${row.id}`)}><Eye className="h-4 w-4" /></Button>
        <Button variant="ghost" size="default" className="h-8 w-8 p-0" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="default" className="h-8 w-8 p-0 text-red-500" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-[#0F172A] dark:text-white">订单管理</h1>
        <Button onClick={openCreate} className="bg-[#3B82F6] hover:bg-[#3B82F6]/90"><Plus className="mr-1 h-4 w-4" /> 新增订单</Button>
      </div>
      <Input placeholder="搜索..." className="w-[320px]" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <DataTable columns={columns} data={data} loading={loading} pagination={pagination} onPageChange={(page) => { setPagination((p) => ({ ...p, page })); fetchData(page, keyword); }} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? '编辑订单' : '新增订单'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">名称 *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="输入订单名称" /></div>
            <div>
              <label className="text-sm font-medium">进货地</label>
              <Select value={form.purchasePlaceId || 'none'} onValueChange={(v) => setForm({ ...form, purchasePlaceId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="选择进货地（可选）" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不选择</SelectItem>
                  {purchasePlaces.map((pp) => <SelectItem key={pp.id} value={pp.id}>{pp.place} - {pp.marketName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">备注</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="输入备注（可选）" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button><Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>确定删除订单 "{deleteTarget?.name}"？</AlertDialogTitle><AlertDialogDescription>如下有明细数据将无法删除。</AlertDialogDescription></AlertDialogHeader>
          <div className="flex justify-end gap-2"><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">删除</AlertDialogAction></div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
