import { useLocation } from 'react-router-dom';
import { Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': '仪表台',
  '/orders': '订单管理 / 订单列表',
  '/categories': '物料管理 / 商品分类',
  '/units': '物料管理 / 商品单位',
  '/commodities': '物料管理 / 商品信息',
  '/purchase-places': '物料管理 / 进货地',
};

function getBreadcrumb(pathname: string): string {
  // Exact match
  if (BREADCRUMB_MAP[pathname]) return `${BREADCRUMB_MAP[pathname]}`;
  // Partial match (e.g. /orders/xxx)
  for (const [prefix, label] of Object.entries(BREADCRUMB_MAP)) {
    if (prefix !== '/dashboard' && pathname.startsWith(prefix)) {
      return `${label}`;
    }
  }
  return '';
}

export default function TopBar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const breadcrumb = getBreadcrumb(location.pathname);
  const initials = (user?.username || 'U')[0].toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-6 dark:border-[#1E293B] dark:bg-[#0F172A] box-content">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        {breadcrumb.split(' / ').map((part, i, arr) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-[#94A3B8]">/</span>}
            <span className={i === arr.length - 1 ? 'font-semibold text-[#0F172A] dark:text-white' : 'text-[#94A3B8]'}>
              {part}
            </span>
          </span>
        ))}
      </div>

      {/* Right: Theme + User + Logout */}
      <div className="flex items-center gap-4">
        <button onClick={toggle} className="text-[#475569] hover:text-[#0F172A] dark:text-[#CBD5E1] dark:hover:text-white">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <span className="text-[13px] font-medium text-[#475569] dark:text-[#CBD5E1]">
          {user?.username || '用户'}
        </span>

        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-[#3B82F6] text-[14px] font-semibold text-white">
            {initials}
          </AvatarFallback>
        </Avatar>

        <Button
          variant="ghost"
          size="default"
          onClick={logout}
          className="h-8 px-2 text-[#475569] hover:text-red-600 dark:text-[#CBD5E1]"
        >
          <LogOut size={16} />
        </Button>
      </div>
    </header>
  );
}
