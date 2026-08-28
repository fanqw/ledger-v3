import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Layout, Grid, Breadcrumb, Drawer } from 'antd';
import { findBreadcrumb } from './menu';
import TopBar from './TopBar';
import SideNav from './SideNav';

const { Content } = Layout;

export default function AppShell() {
  const screens = Grid.useBreakpoint();
  const mobile = screens.lg === false;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [breadcrumbExtra, setBreadcrumbExtra] = useState<ReactNode>(null);

  const location = useLocation();
  const breadcrumb = findBreadcrumb(location.pathname);

  return (
    <Layout className="app-shell">
      <TopBar mobile={mobile} onOpenNavigation={() => setMobileNavOpen(true)} />
      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        {!mobile && <SideNav />}
        <Content className="app-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            {breadcrumb.length > 0 && (
              <Breadcrumb items={breadcrumb.map((b) => ({ title: b }))} />
            )}
            <div style={{ flex: '0 0 auto' }}>{breadcrumbExtra}</div>
          </div>
          <Outlet context={{ setBreadcrumbExtra }} />
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
