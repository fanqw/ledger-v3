import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { DataTable, type Column, type PaginationInfo } from "../components/ui/data-table";
import { toast } from "../lib/toast";
import { authFetch } from "../lib/api";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface PurchasePlace {
  id: string;
  place: string;
  marketName: string;
  description: string | null;
}

export default function PurchasePlacesPage() {
  const [data, setData] = useState<PurchasePlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, pageSize: 20, total: 0 });
  const [keyword, setKeyword] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PurchasePlace | null>(null);
  const [form, setForm] = useState({ place: "", marketName: "", description: "" });
  const [deleteTarget, setDeleteTarget] = useState<PurchasePlace | null>(null);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(false);

  const fetchData = useCallback(async (page: number, kw: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (kw) params.set("keyword", kw);
      const res = await authFetch(`/api/purchase-places?${params}`);
      const json = await res.json();
      if (json.success) { setData(json.data.items); setPagination(json.data.meta); }
    } catch { toast.error("加载进货地失败"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const task = setTimeout(() => { void fetchData(1, ""); }, 0);
    return () => clearTimeout(task);
  }, [fetchData]);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    const t = setTimeout(() => { setPagination((p) => ({ ...p, page: 1 })); fetchData(1, keyword); }, 300);
    return () => clearTimeout(t);
  }, [keyword, fetchData]);

  const openCreate = () => { setEditing(null); setForm({ place: "", marketName: "", description: "" }); setDialogOpen(true); };
  const openEdit = (row: PurchasePlace) => { setEditing(row); setForm({ place: row.place, marketName: row.marketName, description: row.description || "" }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.place.trim()) { toast.error("进货地不能为空"); return; }
    if (!form.marketName.trim()) { toast.error("市场名称不能为空"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/purchase-places/${editing.id}` : "/api/purchase-places";
      const method = editing ? "PATCH" : "POST";
      const res = await authFetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place: form.place.trim(), marketName: form.marketName.trim(), description: form.description.trim() || undefined }),
      });
      const json = await res.json();
      if (json.success) { toast.success(editing ? "更新成功" : "创建成功"); setDialogOpen(false); fetchData(pagination.page, keyword); }
      else { toast.error(json.error?.message || "操作失败"); }
    } catch { toast.error("操作失败"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await authFetch(`/api/purchase-places/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) { toast.success("删除成功"); fetchData(pagination.page, keyword); }
      else { toast.error(json.error?.message || "删除失败"); }
    } catch { toast.error("删除失败"); }
    finally { setDeleteTarget(null); }
  };

  const columns: Column<PurchasePlace>[] = [
    { key: "place", label: "进货地" },
    { key: "marketName", label: "市场名称" },
    { key: "description", label: "备注", render: (v) => (v as string) || "-" },
    { key: "actions", label: "操作", width: "120px", render: (_, row) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="default" className="h-8 w-8 p-0" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="default" className="h-8 w-8 p-0 text-red-500" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-[#0F172A] dark:text-white">进货地</h1>
        <Button onClick={openCreate} className="bg-[#3B82F6] hover:bg-[#3B82F6]/90"><Plus className="mr-1 h-4 w-4" /> 新增进货地</Button>
      </div>
      <Input placeholder="搜索..." className="w-[320px]" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <DataTable columns={columns} data={data} loading={loading} pagination={pagination} onPageChange={(page) => { setPagination((p) => ({ ...p, page })); fetchData(page, keyword); }} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "编辑进货地" : "新增进货地"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">进货地 *</label><Input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="输入进货地" /></div>
            <div><label className="text-sm font-medium">市场名称 *</label><Input value={form.marketName} onChange={(e) => setForm({ ...form, marketName: e.target.value })} placeholder="输入市场名称" /></div>
            <div><label className="text-sm font-medium">备注</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="输入备注（可选）" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button><Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>确定删除进货地 "{deleteTarget?.place} - {deleteTarget?.marketName}"？</AlertDialogTitle><AlertDialogDescription>如有订单关联将无法删除。</AlertDialogDescription></AlertDialogHeader>
          <div className="flex justify-end gap-2"><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">删除</AlertDialogAction></div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
