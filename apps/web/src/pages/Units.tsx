import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Modal, Form, Space, App as AntdApp, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { toast } from '../lib/toast';
import { authFetch } from '../lib/api';
import ResponsiveDataView from '../components/page/ResponsiveDataView';

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
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [sort, setSort] = useState<{ sortBy?: string; sortOrder?: string }>({});
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async (page: number, kw: string, pageSize: number, sortBy?: string, sortOrder?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);
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
    const task = setTimeout(() => { void fetchData(pagination.page, keyword, pagination.pageSize, sort.sortBy, sort.sortOrder); }, delay);
    return () => clearTimeout(task);
  }, [keyword, pagination.page, pagination.pageSize, sort.sortBy, sort.sortOrder, fetchData]);

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
        fetchData(pagination.page, keyword, pagination.pageSize, sort.sortBy, sort.sortOrder);
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
        fetchData(pagination.page, keyword, pagination.pageSize, sort.sortBy, sort.sortOrder);
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

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const sortDir = (key: string) => (sort.sortBy === key ? (sort.sortOrder === 'asc' ? 'ascend' : 'descend') : null);
  const handleTableChange: TableProps<Unit>['onChange'] = (paginationInfo, _filters, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const key = String(s?.field ?? s?.columnKey ?? '');
    const sortBy = key && ['createdAt', 'updatedAt'].includes(key) ? key : undefined;
    const sortOrder = s?.order === 'ascend' ? 'asc' : s?.order === 'descend' ? 'desc' : undefined;
    setPagination((p) => ({ ...p, page: paginationInfo.current ?? 1, pageSize: paginationInfo.pageSize ?? 10 }));
    setSort({ sortBy, sortOrder });
  };
const columns: ColumnsType<Unit> = [
    { title: '名称', dataIndex: 'name' },
    { title: '备注', dataIndex: 'description', render: (v) => v || '-' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', sorter: true, sortOrder: sortDir('createdAt'), render: (v) => formatDate(v as string) },
    { title: '修改时间', dataIndex: 'updatedAt', key: 'updatedAt', sorter: true, sortOrder: sortDir('updatedAt'), render: (v) => formatDate(v as string) },
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
      <Typography.Title level={3} style={{ margin: 0 }}>商品单位</Typography.Title>
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Input.Search
            placeholder="搜索..."
            style={{ width: 320 }}
            allowClear
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={(v) => fetchData(1, v, pagination.pageSize, sort.sortBy, sort.sortOrder)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增单位</Button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>共 {pagination.total} 项</div>
        <ResponsiveDataView items={data} rowKey={(row) => row.id} desktop={<Table<Unit>
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
            <Input.TextArea rows={3}/>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
