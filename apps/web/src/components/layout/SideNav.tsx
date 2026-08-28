import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { findParentMenuKey, MENU_ITEMS } from './menu';

const { Sider } = Layout;
const storageKey = 'ledger:sidebar-collapsed';

const items: MenuProps['items'] = MENU_ITEMS.map((item) => ({
  key: item.key,
  label: item.label,
  icon: item.icon,
  children: item.children?.map((child) => ({
    key: child.key,
    label: child.label,
    icon: child.icon,
  })),
}));

function findSelectedMenuKey(pathname: string): string {
  for (const item of MENU_ITEMS) {
    if (item.key === pathname) return item.key;
    const child = item.children?.find(
      (candidate) => pathname === candidate.key || pathname.startsWith(`${candidate.key}/`),
    );
    if (child) return child.key;
  }
  return pathname;
}

export default function SideNav({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const routeParent = findParentMenuKey(location.pathname);
  const [collapsed, setCollapsed] = useState(
    () => !mobile && window.localStorage.getItem(storageKey) === 'true',
  );
  const [requestedOpenKeys, setRequestedOpenKeys] = useState<string[]>([]);
  // 展开态自动展开当前父级（显示位置）；折叠态不自动展开，避免 submenu 残留
  const openKeys = !collapsed && routeParent && !requestedOpenKeys.includes(routeParent)
    ? [...requestedOpenKeys, routeParent]
    : requestedOpenKeys;

  const onClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
    onNavigate?.();
  };

  const menu = (
    <Menu
      mode="inline"
      inlineCollapsed={mobile ? undefined : collapsed}
      selectedKeys={[findSelectedMenuKey(location.pathname)]}
      openKeys={openKeys}
      onOpenChange={setRequestedOpenKeys}
      items={items}
      onClick={onClick}
    />
  );

  if (mobile) {
    return <nav aria-label="主导航">{menu}</nav>;
  }

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(storageKey, String(next));
  };

  return (
    <Sider
      width={220}
      collapsedWidth={64}
      collapsed={collapsed}
      trigger={null}
      className="app-sider"
      style={{ background: 'var(--surface)' }}
    >
      <nav aria-label="主导航">{menu}</nav>
      <button
        type="button"
        className={`sidebar-collapse-trigger${collapsed ? ' sidebar-collapse-trigger--collapsed' : ''}`}
        aria-label={collapsed ? '展开导航' : '收起导航'}
        onClick={toggleCollapsed}
      >
        {collapsed ? <RightOutlined /> : <LeftOutlined />}
      </button>
    </Sider>
  );
}
