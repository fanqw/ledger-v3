import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Modal, Form, Select, Space, App as AntdApp, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableProps } from 'antd';
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
  updatedAt: string;
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const { modal } = AntdApp.useApp();
  const [form] = Form.useForm<{ name: string; description?: string; cityId?: string; marketId?: string }>();
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ name: '', cityId: '', marketId: '', description: '' });
  const [sort, setSort] = useState<{ sortBy?: string; sortOrder?: string }>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const selectedCityId = Form.useWatch('cityId', form);

  const fetchData = useCallback(async (page: number, pageSize: number, sortBy: string | undefined, sortOrder: string | undefined, f: typeof filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (f.name) params.set('name', f.name);
      if (f.cityId) params.set('cityId', f.cityId);
      if (f.marketId) params.set('marketId', f.marketId);
      if (f.description) params.set('description', f.description);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);
      const res = await authFetch(`/api/orders?${params}`);
      const json = await res.json();
      if (json.success) { setData(json.data.items); setPagination(json.data.meta); }
      else { toast.error(json.error?.message || '加载失败'); }
    } catch { toast.error('加载订单失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const delay = filters.name || filters.description ? 300 : 0;
    const task = setTimeout(() => { void fetchData(pagination.page, pagination.pageSize, sort.sortBy, sort.sortOrder, filters); }, delay);
    return () => clearTimeout(task);
  }, [filters.name, filters.cityId, filters.marketId, filters.description, pagination.page, pagination.pageSize, sort.sortBy, sort.sortOrder, fetchData]);

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

  // 表单：进货市场选项 = 当前选中进货地（城市）下的市场
  const marketOptions = markets
    .filter((m) => !selectedCityId || m.cityId === selectedCityId)
    .map((m) => ({ value: m.id, label: m.name }));
  // 搜索：进货市场选项 = 选中进货地（城市）时过滤，否则全部
  const searchMarketOptions = markets
    .filter((m) => !filters.cityId || m.cityId === filters.cityId)
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
      if (json.success) { toast.success(editing ? '更新成功' : '创建成功'); setDialogOpen(false); fetchData(pagination.page, pagination.pageSize, sort.sortBy, sort.sortOrder, filters); }
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
      if (json.success) { toast.success('删除成功'); fetchData(pagination.page, pagination.pageSize, sort.sortBy, sort.sortOrder, filters); }
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
  // 金额不强制保留小数点后 0
  const formatAmount = (n?: number) => (n ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  // 排序方向（列头状态）
  const sortDir = (key: string) => (sort.sortBy === key ? (sort.sortOrder === 'asc' ? 'ascend' : 'descend') : null);

  const columns: ColumnsType<Order> = [
    { title: '订单名称', dataIndex: 'name' },
    { title: '进货地', render: (_, row) => row.market?.city?.place ?? '-' },
    { title: '进货市场', render: (_, row) => row.market?.name ?? '-' },
    { title: '进货金额', align: 'right', sorter: true, sortOrder: sortDir('amount'), render: (_, row) => formatAmount(row.totalAmount) },
    { title: '创建时间', dataIndex: 'createdAt', sorter: true, sortOrder: sortDir('createdAt'), render: (v) => formatDate(v as string) },
    { title: '修改时间', dataIndex: 'updatedAt', sorter: true, sortOrder: sortDir('updatedAt'), render: (v) => formatDate(v as string) },
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

  // Table 排序/分页变化：服务端排序
  const handleTableChange: TableProps<Order>['onChange'] = (paginationInfo, _filters, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const key = String(s?.field ?? s?.columnKey ?? '');
    const sortBy = key && ['createdAt', 'updatedAt', 'amount'].includes(key) ? key : undefined;
    const sortOrder = s?.order === 'ascend' ? 'asc' : s?.order === 'descend' ? 'desc' : undefined;
    setPagination((p) => ({ ...p, page: paginationInfo.current ?? 1, pageSize: paginationInfo.pageSize ?? 10 }));
    setSort({ sortBy, sortOrder });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>订单列表</Typography.Title>
      <div className="page">
        {/* 搜索：订单名称 / 进货地 / 进货市场 / 备注 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Input
            placeholder="订单名称" allowClear style={{ width: 150 }}
            value={filters.name}
            onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value, cityId: '', marketId: '' }))}
          />
          <Select
            placeholder="进货地" allowClear style={{ width: 150 }}
            value={filters.cityId || undefined}
            options={cities.map((c) => ({ value: c.id, label: c.place }))}
            onChange={(v) => setFilters((f) => ({ ...f, cityId: v || '', marketId: '' }))}
          />
          <Select
            placeholder="进货市场" allowClear style={{ width: 160 }}
            value={filters.marketId || undefined}
            options={searchMarketOptions}
            onChange={(v) => setFilters((f) => ({ ...f, marketId: v || '' }))}
          />
          <Input
            placeholder="备注" allowClear style={{ width: 150 }}
            value={filters.description}
            onChange={(e) => setFilters((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增订单</Button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>共 {pagination.total} 项</div>
        <ResponsiveDataView items={data} rowKey={(row) => row.id} desktop={<Table<Order>
        rowKey="id"
        className="orders-table"
        columns={columns}
        dataSource={data}
        loading={loading}
        onChange={handleTableChange}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showTotal: (t) => `共 ${t} 条`,
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
            <Input.TextArea rows={3} placeholder="输入备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
