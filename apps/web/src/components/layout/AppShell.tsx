import { Outlet } from 'react-router-dom';
import SideNav from './SideNav';
import TopBar from './TopBar';

export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A]">
      <SideNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
