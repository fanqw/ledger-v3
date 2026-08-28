import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Modal, Form, Select, Space, App as AntdApp, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { toast } from '../lib/toast';
import { authFetch } from '../lib/api';
import { fetchAllPages } from '../lib/paged-request';
import ResponsiveDataView from '../components/page/ResponsiveDataView';

interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }
interface Commodity {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  unitId: string;
  category: Category;
  unit: Unit;
}

export default function CommoditiesPage() {
  const { modal } = AntdApp.useApp();
  const [form] = Form.useForm<{ name: string; categoryId: string; unitId: string; description?: string }>();
  const [data, setData] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Commodity | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const fetchData = useCallback(async (page: number, kw: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (kw) params.set('keyword', kw);
      const res = await authFetch(`/api/commodities?${params}`);
      const json = await res.json();
      if (json.success) { setData(json.data.items); setPagination(json.data.meta); }
    } catch { toast.error('加载商品失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const delay = keyword.trim() ? 300 : 0;
    const task = setTimeout(() => { void fetchData(1, keyword); }, delay);
    return () => clearTimeout(task);
  }, [keyword, fetchData]);

  const loadRefs = async () => {
    try {
      const [catItems, unitItems] = await Promise.all([
        fetchAllPages<Category>((page, pageSize) => authFetch(`/api/categories?page=${page}&pageSize=${pageSize}`), 100),
        fetchAllPages<Unit>((page, pageSize) => authFetch(`/api/units?page=${page}&pageSize=${pageSize}`), 100),
      ]);
      setCategories(catItems);
      setUnits(unitItems);
    } catch {
      toast.error('分类和单位加载失败');
    }
  };

  const openCreate = () => { setEditing(null); form.resetFields(); loadRefs(); setDialogOpen(true); };
  const openEdit = (row: Commodity) => {
    setEditing(row);
    loadRefs();
    form.setFieldsValue({ name: row.name, categoryId: row.categoryId, unitId: row.unitId, description: row.description || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    let values: { name: string; categoryId: string; unitId: string; description?: string };
    try {
      values = await form.validateFields();
    } catch { return; }
    setSaving(true);
    try {
      const url = editing ? `/api/commodities/${editing.id}` : '/api/commodities';
      const method = editing ? 'PATCH' : 'POST';
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          categoryId: values.categoryId,
          unitId: values.unitId,
          description: values.description?.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editing ? '更新成功' : '创建成功');
        setDialogOpen(false);
        fetchData(pagination.page, keyword);
      } else {
        toast.error(json.error?.message || '操作失败');
      }
    } catch { toast.error('操作失败'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/commodities/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('删除成功');
        fetchData(pagination.page, keyword);
      } else {
        toast.error(json.error?.message || '删除失败');
      }
    } catch { toast.error('删除失败'); }
    finally { setDeleting(false); }
  };

  const confirmDelete = (row: Commodity) => {
    modal.confirm({
      title: `确定删除商品 "${row.name}"？`,
      content: '如有订单明细关联将无法删除。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => handleDelete(row.id),
    });
  };

  const columns: ColumnsType<Commodity> = [
    { title: '名称', dataIndex: 'name' },
    { title: '分类', render: (_, row) => row.category?.name || '-' },
    { title: '单位', render: (_, row) => row.unit?.name || '-' },
    { title: '备注', dataIndex: 'description', render: (v) => v || '-' },
    {
      title: '操作',
      width: 120,
      render: (_, row) => (
        <Space size={4}>
          <Button type="link" size="small" aria-label={`编辑${row.name}`} icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Button type="link" size="small" danger aria-label={`删除${row.name}`} icon={<DeleteOutlined />} onClick={() => confirmDelete(row)} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>商品信息</Typography.Title>
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Input.Search
            placeholder="搜索商品名/分类/单位..."
            style={{ width: 320 }}
            allowClear
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={(v) => fetchData(1, v)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增商品</Button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>共 {pagination.total} 项</div>
        <ResponsiveDataView items={data} rowKey={(row) => row.id} desktop={<Table<Commodity>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page) => { setPagination((p) => ({ ...p, page })); fetchData(page, keyword); },
        }}
      />} renderMobileItem={(row) => <button className="mobile-record" onClick={() => openEdit(row)}><span className="mobile-record__title">{row.name}</span><span className="mobile-record__meta"><span>{row.category?.name || '未分类'} · {row.unit?.name || '无单位'}</span><span>编辑 ›</span></span></button>} />
      </div>

      <Modal
        title={editing ? '编辑商品' : '新增商品'}
        open={dialogOpen}
        onOk={handleSave}
        onCancel={() => setDialogOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="输入商品名称" />
          </Form.Item>
          <Form.Item name="categoryId" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="选择分类" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="unitId" label="单位" rules={[{ required: true, message: '请选择单位' }]}>
            <Select placeholder="选择单位" options={units.map((u) => ({ value: u.id, label: u.name }))} />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input placeholder="输入备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
