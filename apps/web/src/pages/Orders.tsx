import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Modal, Form, Select, Space, App as AntdApp, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { toast } from '../lib/toast';
import { authFetch } from '../lib/api';
import { fetchAllPages } from '../lib/paged-request';
import ResponsiveDataView from '../components/page/ResponsiveDataView';

interface City { id: string; place: string; }
interface Market { id: string; name: string; cityId?: string; city?: { id: string; place: string } | null; }
interface Order {
  id: string;
  name: string;
  description: string | null;
  marketId: string | null;
  market: Market | null;
  totalAmount?: number;
  createdAt: string;
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const { modal } = AntdApp.useApp();
  const [form] = Form.useForm<{ name: string; description?: string; cityId?: string; marketId?: string }>();
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const selectedCityId = Form.useWatch('cityId', form);

  const fetchData = useCallback(async (page: number, kw: string, pageSize: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
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
    const task = setTimeout(() => { void fetchData(pagination.page, keyword, pagination.pageSize); }, delay);
    return () => clearTimeout(task);
  }, [keyword, pagination.page, pagination.pageSize, fetchData]);

  // 加载进货地（城市）与市场（市场带所属城市）
  const loadOptions = async () => {
    try {
      const [cityItems, marketItems] = await Promise.all([
        fetchAllPages<City>((page, pageSize) => authFetch(`/api/purchase-places?page=${page}&pageSize=${pageSize}`), 100),
        fetchAllPages<Market>((page, pageSize) => authFetch(`/api/markets?page=${page}&pageSize=${pageSize}`), 100),
      ]);
      setCities(cityItems);
      setMarkets(marketItems);
    } catch { toast.error('进货地/市场加载失败'); }
  };

  // 进货市场选项：当前选中进货地（城市）下的市场
  const marketOptions = markets
    .filter((m) => !selectedCityId || m.cityId === selectedCityId)
    .map((m) => ({ value: m.id, label: m.name }));

  const openCreate = async () => {
    setEditing(null);
    form.resetFields();
    loadOptions();
    try {
      const res = await authFetch('/api/orders/next-name');
      const json = await res.json();
      if (json.success) form.setFieldsValue({ name: json.data.name });
    } catch { /* 默认名称获取失败不影响弹窗打开 */ }
    setDialogOpen(true);
  };

  const openEdit = async (row: Order) => {
    setEditing(row);
    await loadOptions();
    form.setFieldsValue({
      name: row.name,
      description: row.description || '',
      cityId: row.market?.cityId || undefined,
      marketId: row.marketId || undefined,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    let values: { name: string; description?: string; cityId?: string; marketId?: string };
    try {
      values = await form.validateFields();
    } catch { return; }
    setSaving(true);
    try {
      const url = editing ? `/api/orders/${editing.id}` : '/api/orders';
      const method = editing ? 'PATCH' : 'POST';
      const body: Record<string, string | null | undefined> = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        // 城市由市场推导（订单只存 marketId）
        marketId: values.marketId || null,
      };
      const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { toast.success(editing ? '更新成功' : '创建成功'); setDialogOpen(false); fetchData(pagination.page, keyword, pagination.pageSize); }
      else { toast.error(json.error?.message || '操作失败'); }
    } catch { toast.error('操作失败'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/orders/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('删除成功'); fetchData(pagination.page, keyword, pagination.pageSize); }
      else { toast.error(json.error?.message || '删除失败'); }
    } catch { toast.error('删除失败'); }
    finally { setDeleting(false); }
  };

  const confirmDelete = (row: Order) => {
    modal.confirm({
      title: `确定删除订单 "${row.name}"？`,
      content: '如下有明细数据将无法删除。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => handleDelete(new MouseEvent('click') as never, row.id),
    });
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const formatAmount = (n?: number) => (n ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const columns: ColumnsType<Order> = [
    { title: '订单名称', dataIndex: 'name' },
    { title: '进货地', render: (_, row) => row.market?.city?.place ?? '-' },
    { title: '进货市场', render: (_, row) => row.market?.name ?? '-' },
    { title: '进货金额', align: 'right', render: (_, row) => formatAmount(row.totalAmount) },
    { title: '创建时间', dataIndex: 'createdAt', render: (v) => formatDate(v as string) },
    {
      title: '操作',
      width: 120,
      render: (_, row) => (
        <Space size={12}>
          <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>编辑</Button>
          <Button type="link" size="small" danger onClick={(e) => { e.stopPropagation(); confirmDelete(row); }}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>订单列表</Typography.Title>
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Input.Search
            placeholder="搜索订单名称/备注/市场..."
            style={{ width: 320 }}
            allowClear
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={(v) => fetchData(1, v, pagination.pageSize)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增订单</Button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>共 {pagination.total} 项</div>
        <ResponsiveDataView items={data} rowKey={(row) => row.id} desktop={<Table<Order>
        rowKey="id"
        className="orders-table"
        columns={columns}
        dataSource={data}
        loading={loading}
        onRow={(record) => ({ onClick: () => navigate(`/orders/${record.id}`) })}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => setPagination((p) => ({ ...p, page, pageSize })),
        }}
      />} renderMobileItem={(row) => <button className="mobile-record" onClick={() => navigate(`/orders/${row.id}`)}><span className="mobile-record__title">{row.name}</span><span className="mobile-record__meta"><span>{row.market ? `${row.market.city?.place ?? ''} / ${row.market.name}` : '未设置'}</span><span>{formatAmount(row.totalAmount)} ›</span></span></button>} />
      </div>

      <Modal
        title={editing ? '编辑订单' : '新增订单'}
        open={dialogOpen}
        onOk={handleSave}
        onCancel={() => setDialogOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="订单名称" rules={[{ required: true, message: '请输入订单名称' }]}>
            <Input placeholder="输入订单名称" />
          </Form.Item>
          <Form.Item name="cityId" label="进货地" rules={[{ required: true, message: '请选择进货地' }]}>
            <Select
              placeholder="选择进货地（城市）"
              options={cities.map((c) => ({ value: c.id, label: c.place }))}
              onChange={() => form.setFieldValue('marketId', undefined)}
            />
          </Form.Item>
          <Form.Item name="marketId" label="进货市场" rules={[{ required: true, message: '请选择进货市场' }]}>
            <Select
              placeholder="选择进货市场"
              options={marketOptions}
              disabled={!selectedCityId}
            />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input placeholder="输入备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
