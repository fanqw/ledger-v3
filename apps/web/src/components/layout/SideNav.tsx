import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
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

  const top = MENU_ITEMS.find((t) => t.key === activeTop);
  const items: MenuProps['items'] = (top?.children || []).map((c) => ({ key: c.key, label: c.label }));

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
      style={{
        background: 'var(--surface)',
        borderRight: '1px solid var(--line)',
        position: 'relative',
        overflow: 'auto',
      }}
    >
      <Menu
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={[location.pathname]}
        items={items}
        onClick={onClick}
        style={{ borderRight: 0, background: 'transparent' }}
      />
      {!mobile && (
        <div
          onClick={() => setCollapsed((c) => !c)}
          style={{
            position: 'sticky',
            bottom: 0,
            width: '100%',
            padding: '12px 0',
            textAlign: 'center',
            cursor: 'pointer',
            color: 'var(--muted)',
            borderTop: '1px solid var(--line)',
            background: 'var(--surface)',
          }}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      )}
    </Sider>
  );
}
