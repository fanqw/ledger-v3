import { useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Space, Avatar, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { MenuOutlined, SunOutlined, MoonOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useAuth } from '../../lib/auth';
import { useThemeMode } from '../../lib/theme';
import { MENU_ITEMS } from './menu';

const { Header } = Layout;

export default function TopBar({
  mobile = false,
  activeTop,
  onSelectTop,
  onOpenNavigation,
}: {
  mobile?: boolean;
  activeTop: string;
  onSelectTop: (k: string) => void;
  onOpenNavigation?: () => void;
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const initials = (user?.username || 'U')[0].toUpperCase();

  // mix 布局：顶栏一级菜单（横向）
  const topItems: MenuProps['items'] = MENU_ITEMS.map((t) => ({
    key: t.key,
    icon: t.icon,
    label: t.label,
  }));

  const onClick: MenuProps['onClick'] = ({ key }) => {
    onSelectTop(key);
    const top = MENU_ITEMS.find((t) => t.key === key);
    if (!top?.children) navigate(key); // 一级直达（无二级）
  };

  return (
    <Header
      className="app-header"
      style={{
        height: 56,
        lineHeight: '56px',
        background: 'var(--surface)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--line)',
        flex: '0 0 auto',
      }}
    >
      {/* 左：logo + 系统名 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: mobile ? 8 : 24 }}>
        {mobile && (
          <Button type="text" icon={<MenuOutlined />} onClick={onOpenNavigation} style={{ marginRight: 4 }} />
        )}
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: '#3B82F6',
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
        <span style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--text)' }}>台帐系统</span>
      </div>

      {/* 中：一级菜单（横向） */}
      {!mobile && (
        <Menu
          mode="horizontal"
          items={topItems}
          selectedKeys={[activeTop]}
          onClick={onClick}
          style={{ flex: 1, minWidth: 0, borderBottom: 0, background: 'transparent' }}
        />
      )}

      {/* 右：主题切换 + 用户名 + 头像 */}
      <Space size={12} style={{ marginLeft: 'auto' }}>
        <Button
          type="text"
          icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggle}
          aria-label="切换主题"
        />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user?.username || '用户'}</span>
        <Dropdown
          menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: logout }] }}
          placement="bottomRight"
        >
          <Avatar style={{ background: '#3B82F6', cursor: 'pointer' }} icon={<UserOutlined />}>
            {initials}
          </Avatar>
        </Dropdown>
      </Space>
    </Header>
  );
}
