import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import SideNav from './SideNav';
import TopBar from './TopBar';

const { Content } = Layout;

export default function AppShell() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SideNav />
      <Layout>
        <TopBar />
        <Content style={{ padding: 24, background: '#f0f2f5', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
