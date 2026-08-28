import { Layout, Button, Space, Avatar, Dropdown } from 'antd';
import { MenuOutlined, SunOutlined, MoonOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useAuth } from '../../lib/auth';
import { useThemeMode } from '../../lib/theme';

const { Header } = Layout;

export default function TopBar({
  mobile = false,
  onOpenNavigation,
}: {
  mobile?: boolean;
  onOpenNavigation?: () => void;
}) {
  const { user, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const initials = (user?.username || 'U')[0].toUpperCase();

  return (
    <Header
      className="app-header"
      style={{
        height: 56,
        lineHeight: '56px',
        background: 'var(--surface)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--line)',
        flex: '0 0 auto',
      }}
    >
      {/* 左侧：logo + 系统名 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {mobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            aria-label="打开导航"
            onClick={onOpenNavigation}
            style={{ marginRight: 4 }}
          />
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

      {/* 右侧：主题切换 + 头像 + 名称（名称在头像右侧） */}
      <Space size={12}>
        <Button
          type="text"
          icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggle}
          aria-label="切换主题"
        />
        <Dropdown
          menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: logout }] }}
          placement="bottomRight"
        >
          <Space size={8} style={{ cursor: 'pointer' }}>
            <Avatar size={24} style={{ background: '#3B82F6' }} icon={<UserOutlined />}>
              {initials}
            </Avatar>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user?.username || '用户'}</span>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
}
