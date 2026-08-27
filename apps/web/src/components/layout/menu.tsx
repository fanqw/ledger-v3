import { BarChartOutlined, ProfileOutlined, BankOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

export interface TopMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  children?: { key: string; label: string }[];
}

// antd pro 混合布局菜单：顶栏一级 + 侧边二级（经典模式）
export const MENU_ITEMS: TopMenuItem[] = [
  { key: '/analytics', label: '数据分析', icon: <BarChartOutlined /> },
  {
    key: 'orders',
    label: '订单管理',
    icon: <ProfileOutlined />,
    children: [{ key: '/orders', label: '订单列表' }],
  },
  {
    key: 'materials',
    label: '物料管理',
    icon: <BankOutlined />,
    children: [
      { key: '/categories', label: '商品分类' },
      { key: '/units', label: '商品单位' },
      { key: '/commodities', label: '商品信息' },
      { key: '/purchase-places', label: '进货地' },
    ],
  },
];

/** 从路径推断当前一级菜单 key */
export function findTopKey(pathname: string): string {
  for (const t of MENU_ITEMS) {
    if (t.children?.some((c) => pathname.startsWith(c.key))) return t.key;
    if (pathname === t.key) return t.key;
  }
  return 'orders';
}

/** 面包屑：基于路径返回 [一级, 二级] */
export function findBreadcrumb(pathname: string): string[] {
  for (const t of MENU_ITEMS) {
    const child = t.children?.find((c) => pathname.startsWith(c.key));
    if (child) return [t.label, child.label];
    if (pathname === t.key) return [t.label];
  }
  return [];
}
