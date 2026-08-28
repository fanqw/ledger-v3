import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { MENU_ITEMS } from './menu';

const { Sider } = Layout;

export default function SideNav({
  mobile = false,
  activeTop,
  onNavigate,
}: {
  mobile?: boolean;
  activeTop: string;
  onNavigate?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // mix 布局：侧边显示当前一级的二级菜单（经典 sub 模式）
  const top = MENU_ITEMS.find((t) => t.key === activeTop);
  const items: ItemType[] = (top?.children || []).map((c) => ({ key: c.key, label: c.label, icon: c.icon }));

  const onClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
    onNavigate?.();
  };

  return (
    <Sider
      width={180}
      collapsedWidth={64}
      collapsible
      collapsed={collapsed}
      trigger={null}
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--line)', position: 'relative' }}
    >
      <Menu
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={[location.pathname]}
        items={items}
        onClick={onClick}
        style={{ borderRight: 0, background: 'transparent', paddingBottom: 48 }}
      />
      {/* 折叠按钮：sider 与内容区交界处，横跨两侧，高 48px */}
      {!mobile && (
        <div
          onClick={() => setCollapsed((c) => !c)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 48,
            width: collapsed ? 64 : 'calc(100% + 36px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--muted)',
            borderTop: '1px solid var(--line)',
            background: 'var(--surface)',
            zIndex: 2,
          }}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      )}
    </Sider>
  );
}
