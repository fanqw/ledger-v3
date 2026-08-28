import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Modal, Form, Space, App as AntdApp, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { toast } from '../lib/toast';
import { authFetch } from '../lib/api';
import ResponsiveDataView from '../components/page/ResponsiveDataView';

interface Category {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CategoriesPage() {
  const { modal } = AntdApp.useApp();
  const [form] = Form.useForm<{ name: string; description?: string }>();
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async (page: number, kw: string, pageSize: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (kw) params.set('keyword', kw);
      const res = await authFetch(`/api/categories?${params}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data.items);
        setPagination(json.data.meta);
      }
    } catch { toast.error('加载分类失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const delay = keyword.trim() ? 300 : 0;
    const task = setTimeout(() => { void fetchData(pagination.page, keyword, pagination.pageSize); }, delay);
    return () => clearTimeout(task);
  }, [keyword, pagination.page, pagination.pageSize, fetchData]);

  const openCreate = () => { setEditing(null); form.resetFields(); setDialogOpen(true); };
  const openEdit = (row: Category) => { setEditing(row); form.setFieldsValue({ name: row.name, description: row.description || '' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (saving) return;
    let values: { name: string; description?: string };
    try {
      values = await form.validateFields();
    } catch { return; }
    setSaving(true);
    try {
      const url = editing ? `/api/categories/${editing.id}` : '/api/categories';
      const method = editing ? 'PATCH' : 'POST';
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name.trim(), description: values.description?.trim() || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editing ? '更新成功' : '创建成功');
        setDialogOpen(false);
        fetchData(pagination.page, keyword, pagination.pageSize);
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
      const res = await authFetch(`/api/categories/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('删除成功');
        fetchData(pagination.page, keyword, pagination.pageSize);
      } else {
        toast.error(json.error?.message || '删除失败');
      }
    } catch { toast.error('删除失败'); }
    finally { setDeleting(false); }
  };

  const confirmDelete = (row: Category) => {
    modal.confirm({
      title: `确定删除分类 "${row.name}"？`,
      content: '如有商品关联将无法删除。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => handleDelete(row.id),
    });
  };

  const columns: ColumnsType<Category> = [
    { title: '名称', dataIndex: 'name' },
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
      {/* 页面标题（内容区顶部，移出卡片） */}
      <Typography.Title level={3} style={{ margin: 0 }}>商品分类</Typography.Title>
      <div className="page">
        {/* 工具行：搜索左 + 操作右 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Input.Search
            placeholder="搜索..."
            style={{ width: 320 }}
            allowClear
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={(v) => fetchData(1, v, pagination.pageSize)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增分类</Button>
        </div>
        {/* 共 x 项 */}
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>共 {pagination.total} 项</div>
        <ResponsiveDataView items={data} rowKey={(row) => row.id} desktop={<Table<Category>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (page, pageSize) => setPagination((p) => ({ ...p, page, pageSize })),
          }}
        />} renderMobileItem={(row) => <button className="mobile-record" onClick={() => openEdit(row)}><span className="mobile-record__title">{row.name}</span><span className="mobile-record__meta"><span>{row.description || '无备注'}</span><span>编辑 ›</span></span></button>} />
      </div>

      <Modal
        title={editing ? '编辑分类' : '新增分类'}
        open={dialogOpen}
        onOk={handleSave}
        onCancel={() => setDialogOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="输入分类名称" />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input placeholder="输入备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
