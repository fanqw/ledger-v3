import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  ChevronLeft,
  ChevronRight,
  Package,
  Ruler,
  ShoppingCart,
  MapPin,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "../ui/tooltip";
import { Separator } from "../ui/separator";

const NAV_SECTIONS = [
  {
    label: "订单",
    items: [{ to: "/orders", label: "订单管理", icon: FileText }],
  },
  {
    label: "物料管理",
    items: [
      { to: "/categories", label: "商品分类", icon: Package },
      { to: "/units", label: "商品单位", icon: Ruler },
      { to: "/commodities", label: "商品信息", icon: ShoppingCart },
      { to: "/purchase-places", label: "进货地", icon: MapPin },
    ],
  },
];

export default function SideNav() {
  const [collapsed, setCollapsed] = useState(() => {
    if (window.innerWidth < 1280) return true;
    const stored = localStorage.getItem("ledger:sidebar-collapsed");
    return stored === "true";
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("ledger:sidebar-collapsed", String(next));
  };

  const location = useLocation();

  const linkClass = (active: boolean) =>
    `flex items-center gap-2 rounded-md px-2 my-2 py-1.5 text-[13px] font-medium transition-colors ${
      collapsed ? "justify-center" : ""
    } ${
      active
        ? "bg-[#3B82F6] text-white font-semibold"
        : "text-[#475569] hover:bg-[#3B82F6]/10 dark:text-[#CBD5E1] dark:hover:bg-[#3B82F6]/20"
    }`;

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col bg-[#F1F5F9] transition-all duration-200 dark:bg-[#1E293B] ${
          collapsed ? "w-[56px]" : "w-[180px]"
        }`}
      >
        {/* Logo — height aligned with TopBar (h-14 = 56px) */}
        <div
          className={`flex h-14 shrink-0  items-center gap-2 ${collapsed ? "justify-center" : "px-4"}`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#3B82F6]">
            <span className="text-sm font-bold text-white">台</span>
          </div>
          {!collapsed && (
            <span className="text-[16px] font-bold text-[#0F172A] dark:text-white whitespace-nowrap">
              台帐系统
            </span>
          )}
        </div>

        <Separator className="bg-[#E2E8F0] dark:bg-[#334155]" />

        {/* Navigation */}
        <nav
          className={`flex flex-1 flex-col gap-0.5 overflow-y-auto py-2 ${collapsed ? "px-2" : "px-4"}`}
        >
          {/* Dashboard — standalone, no section label */}
          {(() => {
            const active = location.pathname === "/dashboard";
            const item = (
              <NavLink to="/dashboard" end className={linkClass(active)}>
                <LayoutDashboard size={18} className="shrink-0" />
                {!collapsed && (
                  <span className="whitespace-nowrap">仪表台</span>
                )}
              </NavLink>
            );
            if (collapsed) {
              return (
                <Tooltip key="dashboard">
                  <TooltipTrigger asChild>{item}</TooltipTrigger>
                  <TooltipContent side="right">仪表台</TooltipContent>
                </Tooltip>
              );
            }
            return item;
          })()}

          {/* Sectioned groups */}
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mt-1">
              {!collapsed && (
                <div className="px-2 py-1 text-[11px] font-semibold text-[#94A3B8] dark:text-slate-400">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const active =
                  location.pathname === item.to ||
                  location.pathname.startsWith(item.to + "/");
                const navItem = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={linkClass(active)}
                  >
                    <item.icon size={18} className="shrink-0" />
                    {!collapsed && (
                      <span className="whitespace-nowrap">{item.label}</span>
                    )}
                  </NavLink>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return navItem;
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className={`flex shrink-0 items-center gap-2 rounded-md px-2 py-2  text-[11px] text-[#94A3B8] hover:bg-slate-200 dark:hover:bg-slate-700 ${collapsed ? "mx-2 justify-center" : "mx-4"}`}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && "收起菜单"}
        </button>
      </aside>
    </TooltipProvider>
  );
}
