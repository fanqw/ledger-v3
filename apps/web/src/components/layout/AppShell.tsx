import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Layout, Grid, Breadcrumb, Drawer } from 'antd';
import { findBreadcrumb } from './menu';
import TopBar from './TopBar';
import SideNav from './SideNav';

const { Content } = Layout;

export default function AppShell() {
  const screens = Grid.useBreakpoint();
  const mobile = screens.lg === false;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const location = useLocation();
  const breadcrumb = findBreadcrumb(location.pathname);

  return (
    <Layout className="app-shell">
      <TopBar mobile={mobile} onOpenNavigation={() => setMobileNavOpen(true)} />
      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        {!mobile && <SideNav />}
        <Content className="app-content">
          {breadcrumb.length > 0 && (
            <Breadcrumb items={breadcrumb.map((b) => ({ title: b }))} style={{ marginBottom: 16 }} />
          )}
          <Outlet />
        </Content>
      </Layout>
      <Drawer
        title="台帐系统"
        placement="left"
        size={280}
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        className="mobile-nav-drawer"
      >
        <SideNav mobile onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>
    </Layout>
  );
}
