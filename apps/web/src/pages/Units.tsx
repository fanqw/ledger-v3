import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Modal, Form, Space, App as AntdApp, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { toast } from '../lib/toast';
import { authFetch } from '../lib/api';

interface Unit {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function UnitsPage() {
  const { modal } = AntdApp.useApp();
  const [form] = Form.useForm<{ name: string; description?: string }>();
  const [data, setData] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async (page: number, kw: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (kw) params.set('keyword', kw);
      const res = await authFetch(`/api/units?${params}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data.items);
        setPagination(json.data.meta);
      }
    } catch { toast.error('加载单位失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const delay = keyword.trim() ? 300 : 0;
    const task = setTimeout(() => { void fetchData(1, keyword); }, delay);
    return () => clearTimeout(task);
  }, [keyword, fetchData]);

  const openCreate = () => { setEditing(null); form.resetFields(); setDialogOpen(true); };
  const openEdit = (row: Unit) => { setEditing(row); form.setFieldsValue({ name: row.name, description: row.description || '' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (saving) return;
    let values: { name: string; description?: string };
    try {
      values = await form.validateFields();
    } catch { return; }
    setSaving(true);
    try {
      const url = editing ? `/api/units/${editing.id}` : '/api/units';
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
      const res = await authFetch(`/api/units/${id}`, { method: 'DELETE' });
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

  const confirmDelete = (row: Unit) => {
    modal.confirm({
      title: `确定删除单位 "${row.name}"？`,
      content: '如有商品关联将无法删除。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => handleDelete(row.id),
    });
  };

  const columns: ColumnsType<Unit> = [
    { title: '名称', dataIndex: 'name' },
    { title: '备注', dataIndex: 'description', render: (v) => v || '-' },
    {
      title: '操作',
      width: 120,
      render: (_, row) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDelete(row)} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>商品单位</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增单位</Button>
      </div>

      <Input.Search
        placeholder="搜索..."
        style={{ width: 320 }}
        allowClear
        onChange={(e) => setKeyword(e.target.value)}
        onSearch={(v) => fetchData(1, v)}
      />

      <Table<Unit>
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
      />

      <Modal
        title={editing ? '编辑单位' : '新增单位'}
        open={dialogOpen}
        onOk={handleSave}
        onCancel={() => setDialogOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="输入单位名称" />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input placeholder="输入备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
