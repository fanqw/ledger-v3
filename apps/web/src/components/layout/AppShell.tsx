import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Drawer, Grid, Layout } from 'antd';
import SideNav from './SideNav';
import TopBar from './TopBar';

const { Content } = Layout;

export default function AppShell() {
  const screens = Grid.useBreakpoint();
  const mobile = screens.lg === false;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <Layout className="app-shell">
      {!mobile && <SideNav />}
      <Layout className="app-workspace">
        <TopBar mobile={mobile} onOpenNavigation={() => setMobileNavOpen(true)} />
        <Content className="app-content"><Outlet /></Content>
      </Layout>
      <Drawer title="台帐系统" placement="left" size={280} open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)} className="mobile-nav-drawer">
        <SideNav mobile onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>
    </Layout>
  );
}
