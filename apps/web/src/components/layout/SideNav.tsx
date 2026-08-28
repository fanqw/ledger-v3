import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useState } from 'react';
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
  const [openKeys, setOpenKeys] = useState<string[]>(() => (routeParent ? [routeParent] : []));

  useEffect(() => {
    const parent = findParentMenuKey(location.pathname);
    if (parent) {
      setOpenKeys((keys) => (keys.includes(parent) ? keys : [...keys, parent]));
    }
  }, [location.pathname]);

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
      onOpenChange={setOpenKeys}
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
        className="sidebar-collapse-trigger"
        aria-label={collapsed ? '展开导航' : '收起导航'}
        onClick={toggleCollapsed}
      >
        {collapsed ? <RightOutlined /> : <LeftOutlined />}
      </button>
    </Sider>
  );
}
