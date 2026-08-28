import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout, Grid, Breadcrumb, Drawer } from 'antd';
import { findTopKey, findBreadcrumb } from './menu';
import TopBar from './TopBar';
import SideNav from './SideNav';

const { Content } = Layout;

export default function AppShell() {
  const screens = Grid.useBreakpoint();
  const mobile = screens.lg === false;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const location = useLocation();
  const topKey = findTopKey(location.pathname);
  const [activeTop, setActiveTop] = useState(topKey);
  useEffect(() => { setActiveTop(topKey); }, [topKey]);
  const breadcrumb = findBreadcrumb(location.pathname);

  return (
    <Layout className="app-shell">
      <TopBar
        mobile={mobile}
        activeTop={activeTop}
        onSelectTop={setActiveTop}
        onOpenNavigation={() => setMobileNavOpen(true)}
      />
      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        {!mobile && <SideNav activeTop={activeTop} />}
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
        <SideNav mobile activeTop={activeTop} onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>
    </Layout>
  );
}
