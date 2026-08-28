import { BarChartOutlined, ProfileOutlined, BankOutlined, TagsOutlined, AppstoreOutlined, ShoppingCartOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

export interface MenuChild {
  key: string;
  label: string;
  icon?: ReactNode;
}

export interface TopMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  children?: MenuChild[];
}

// 菜单结构：分组（sider 经典模式展示）
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
      { key: '/categories', icon: <TagsOutlined />, label: '商品分类' },
      { key: '/units', icon: <AppstoreOutlined />, label: '商品单位' },
      { key: '/commodities', icon: <ShoppingCartOutlined />, label: '商品信息' },
      { key: '/purchase-places', icon: <EnvironmentOutlined />, label: '进货地' },
    ],
  },
];

/** 从路径推断当前一级菜单 key（mix 布局顶栏高亮用） */
export function findTopKey(pathname: string): string {
  for (const t of MENU_ITEMS) {
    if (t.children?.some((c) => pathname.startsWith(c.key))) return t.key;
    if (pathname === t.key) return t.key;
  }
  return 'orders';
}

/** 面包屑：基于路径返回 [分组, 页面] */
export function findBreadcrumb(pathname: string): string[] {
  for (const t of MENU_ITEMS) {
    const child = t.children?.find((c) => pathname.startsWith(c.key));
    if (child) return [t.label, child.label];
    if (pathname === t.key) return [t.label];
  }
  return [];
}
