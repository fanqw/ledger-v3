import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import SideNav from './SideNav';
import TopBar from './TopBar';

export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A]">
      <SideNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
