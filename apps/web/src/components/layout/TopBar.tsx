import { useLocation } from 'react-router-dom';
import { Layout, Avatar, Dropdown, Space } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../../lib/auth';

const { Header } = Layout;

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': '仪表台',
  '/orders': '订单管理 / 订单列表',
  '/categories': '物料管理 / 商品分类',
  '/units': '物料管理 / 商品单位',
  '/commodities': '物料管理 / 商品信息',
  '/purchase-places': '物料管理 / 进货地',
  '/analytics': '数据分析',
};

function getBreadcrumb(pathname: string): string {
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];
  for (const [prefix, label] of Object.entries(BREADCRUMB_MAP)) {
    if (prefix !== '/dashboard' && pathname.startsWith(prefix)) {
      return label;
    }
  }
  return '';
}

export default function TopBar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const breadcrumb = getBreadcrumb(location.pathname);
  const initials = (user?.username || 'U')[0].toUpperCase();

  return (
    <Header
      style={{
        height: 56,
        lineHeight: '56px',
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      {/* 面包屑 */}
      <div style={{ fontSize: 14 }}>
        {breadcrumb.split(' / ').map((part, i, arr) => (
          <span key={i}>
            {i > 0 && <span style={{ color: '#999', margin: '0 4px' }}>/</span>}
            <span style={i === arr.length - 1 ? { fontWeight: 600 } : { color: '#666' }}>{part}</span>
          </span>
        ))}
      </div>

      {/* 用户信息 + 登出 */}
      <Space size={12}>
        <span style={{ fontSize: 13, color: '#595959' }}>{user?.username || '用户'}</span>
        <Dropdown
          menu={{
            items: [
              { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: logout },
            ],
          }}
          placement="bottomRight"
        >
          <Avatar style={{ background: '#0288D1', cursor: 'pointer' }} icon={<UserOutlined />}>
            {initials}
          </Avatar>
        </Dropdown>
      </Space>
    </Header>
  );
}
