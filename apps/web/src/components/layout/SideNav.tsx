import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  BarChartOutlined,
  ProfileOutlined,
  BankOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

// antd Menu items：对齐 V1 layout 结构（分组子菜单 + 路由 key）
const items: MenuProps['items'] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表台' },
  { key: '/analytics', icon: <BarChartOutlined />, label: '数据分析' },
  {
    key: 'orders',
    icon: <ProfileOutlined />,
    label: '订单管理',
    children: [{ key: '/orders', label: '订单列表' }],
  },
  {
    key: 'materials',
    icon: <BankOutlined />,
    label: '物料管理',
    children: [
      { key: '/categories', label: '商品分类' },
      { key: '/units', label: '商品单位' },
      { key: '/commodities', label: '商品信息' },
      { key: '/purchase-places', label: '进货地' },
    ],
  },
];

export default function SideNav() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (window.innerWidth < 1280) return true;
    const stored = localStorage.getItem('ledger:sidebar-collapsed');
    return stored === 'true';
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('ledger:sidebar-collapsed', String(next));
  };

  const location = useLocation();
  const navigate = useNavigate();

  const onClick: MenuProps['onClick'] = ({ key }) => navigate(key);

  return (
    <Sider
      width={180}
      collapsedWidth={64}
      collapsible
      collapsed={collapsed}
      trigger={null}
      style={{ background: '#fff', borderRight: '1px solid #f0f0f0', position: 'relative' }}
    >
      {/* Logo */}
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderBottom: '1px solid #f0f0f0',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: '#0F766E',
            color: '#fff',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          台
        </span>
        {!collapsed && (
          <span style={{ fontWeight: 'bold', fontSize: 15, whiteSpace: 'nowrap' }}>台帐系统</span>
        )}
      </div>

      <Menu
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={[location.pathname]}
        items={items}
        onClick={onClick}
        style={{ borderRight: 0 }}
      />

      {/* Collapse toggle */}
      <div
        onClick={toggle}
        style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          padding: '12px 0',
          textAlign: 'center',
          cursor: 'pointer',
          color: '#8c8c8c',
          borderTop: '1px solid #f0f0f0',
        }}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        {!collapsed && (
          <span style={{ fontSize: 12, marginLeft: 6 }}>收起菜单</span>
        )}
      </div>
    </Sider>
  );
}
