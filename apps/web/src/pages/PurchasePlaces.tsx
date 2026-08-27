import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Modal, Form, Space, App as AntdApp } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { toast } from '../lib/toast';
import { authFetch } from '../lib/api';
import PageHeader from '../components/page/PageHeader';
import PageToolbar from '../components/page/PageToolbar';

interface PurchasePlace {
  id: string;
  place: string;
  marketName: string;
  description: string | null;
}

export default function PurchasePlacesPage() {
  const { modal } = AntdApp.useApp();
  const [form] = Form.useForm<{ place: string; marketName: string; description?: string }>();
  const [data, setData] = useState<PurchasePlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PurchasePlace | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async (page: number, kw: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (kw) params.set('keyword', kw);
      const res = await authFetch(`/api/purchase-places?${params}`);
      const json = await res.json();
      if (json.success) { setData(json.data.items); setPagination(json.data.meta); }
    } catch { toast.error('加载进货地失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const delay = keyword.trim() ? 300 : 0;
    const task = setTimeout(() => { void fetchData(1, keyword); }, delay);
    return () => clearTimeout(task);
  }, [keyword, fetchData]);

  const openCreate = () => { setEditing(null); form.resetFields(); setDialogOpen(true); };
  const openEdit = (row: PurchasePlace) => {
    setEditing(row);
    form.setFieldsValue({ place: row.place, marketName: row.marketName, description: row.description || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    let values: { place: string; marketName: string; description?: string };
    try {
      values = await form.validateFields();
    } catch { return; }
    setSaving(true);
    try {
      const url = editing ? `/api/purchase-places/${editing.id}` : '/api/purchase-places';
      const method = editing ? 'PATCH' : 'POST';
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place: values.place.trim(), marketName: values.marketName.trim(), description: values.description?.trim() || undefined }),
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
      const res = await authFetch(`/api/purchase-places/${id}`, { method: 'DELETE' });
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

  const confirmDelete = (row: PurchasePlace) => {
    modal.confirm({
      title: `确定删除进货地 "${row.place} - ${row.marketName}"？`,
      content: '如有订单关联将无法删除。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => handleDelete(row.id),
    });
  };

  const columns: ColumnsType<PurchasePlace> = [
    { title: '进货地点', dataIndex: 'place' },
    { title: '市场名称', dataIndex: 'marketName' },
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
    <div className="page">
      <PageHeader title="进货地" description="维护常用采购地点与市场" actions={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增进货地</Button>} />
      <PageToolbar>
        <Input.Search
          placeholder="搜索..."
          style={{ width: 320 }}
          allowClear
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={(v) => fetchData(1, v)}
        />
      </PageToolbar>

      <Table<PurchasePlace>
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
        title={editing ? '编辑进货地' : '新增进货地'}
        open={dialogOpen}
        onOk={handleSave}
        onCancel={() => setDialogOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="place" label="进货地点" rules={[{ required: true, message: '请输入进货地点' }]}>
            <Input placeholder="输入进货地点" />
          </Form.Item>
          <Form.Item name="marketName" label="市场名称" rules={[{ required: true, message: '请输入市场名称' }]}>
            <Input placeholder="输入市场名称" />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input placeholder="输入备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
