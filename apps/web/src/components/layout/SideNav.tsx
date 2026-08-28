import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { MENU_ITEMS } from './menu';

const { Sider } = Layout;

export default function SideNav({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // 经典模式：一级独立项 + 分组二级（antd Menu group）
  const items = MENU_ITEMS.flatMap((t): ItemType[] => {
    if (t.children) {
      return [
        {
          type: 'group',
          label: t.label,
          children: t.children.map((c) => ({ key: c.key, label: c.label, icon: c.icon })),
        },
      ];
    }
    return [{ key: t.key, label: t.label, icon: t.icon }];
  });

  const onClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
    onNavigate?.();
  };

  // antd pro 风格折叠：使用 antd Sider 默认 trigger（底部条，48px 高，图标居中，悬停变色）
  return (
    <Sider
      width={180}
      collapsedWidth={64}
      collapsible={!mobile}
      collapsed={collapsed}
      onCollapse={(c) => setCollapsed(c)}
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--line)' }}
    >
      <Menu
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={[location.pathname]}
        items={items}
        onClick={onClick}
        style={{ borderRight: 0, background: 'transparent' }}
      />
    </Sider>
  );
}
