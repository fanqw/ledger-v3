import {
  BarChartOutlined,
  ProfileOutlined,
  BankOutlined,
  TagsOutlined,
  AppstoreOutlined,
  ShoppingCartOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';

/** 菜单数据项，采用 antd pro MenuDataItem 结构（key/path/name/icon/children） */
export interface MenuDataItem {
  /** 菜单 key：叶子项为跳转路径，父级为分组标识 */
  key: string;
  /** 叶子项跳转路径 */
  path?: string;
  /** 显示名 */
  name: string;
  icon?: ReactNode;
  children?: MenuDataItem[];
  /** 隐藏菜单项（不出现在菜单，但路径仍可访问） */
  hideInMenu?: boolean;
}

// 菜单结构：一级入口 + 可展开的父子导航
export const MENU_ITEMS: MenuDataItem[] = [
  { key: '/analytics', path: '/analytics', name: '数据分析', icon: <BarChartOutlined /> },
  { key: '/orders', path: '/orders', name: '订单管理', icon: <ProfileOutlined /> },
  {
    key: 'materials',
    name: '物料管理',
    icon: <BankOutlined />,
    children: [
      { key: '/categories', path: '/categories', name: '商品分类', icon: <TagsOutlined /> },
      { key: '/units', path: '/units', name: '商品单位', icon: <AppstoreOutlined /> },
      { key: '/commodities', path: '/commodities', name: '商品信息', icon: <ShoppingCartOutlined /> },
      { key: '/purchase-places', path: '/purchase-places', name: '进货地', icon: <EnvironmentOutlined /> },
    ],
  },
];

/** 过滤 hideInMenu 的项 */
function filterVisible(items: MenuDataItem[]): MenuDataItem[] {
  return items.filter((item) => !item.hideInMenu);
}

/**
 * 路由匹配菜单链（antd pro getMatchMenu 简化版）。
 * 从根到叶子返回匹配路径，供 selectedKeys / openKeys / 面包屑使用。
 */
export function getMatchMenu(pathname: string, menuData: MenuDataItem[] = MENU_ITEMS): MenuDataItem[] {
  for (const item of filterVisible(menuData)) {
    if (item.children?.length) {
      const child = getMatchMenu(pathname, item.children);
      if (child.length) return [item, ...child];
    } else if (
      item.path &&
      (pathname === item.path || pathname.startsWith(`${item.path}/`))
    ) {
      return [item];
    }
  }
  return [];
}

/** 面包屑：基于路径返回 [分组, 页面] */
export function findBreadcrumb(pathname: string, menuData: MenuDataItem[] = MENU_ITEMS): string[] {
  return getMatchMenu(pathname, menuData).map((item) => item.name);
}

/**
 * 菜单数据 → antd Menu items（antd pro MenuUtil.getNavMenuItems 简化版）。
 * 有 children 转 SubMenu，无 children 转 MenuItem；key 沿用菜单 key。
 */
export function getNavMenuItems(menuData: MenuDataItem[]): NonNullable<MenuProps['items']> {
  return filterVisible(menuData).map((item) => {
    if (item.children?.length) {
      return {
        key: item.key,
        icon: item.icon,
        label: item.name,
        children: getNavMenuItems(item.children),
      };
    }
    return { key: item.key, icon: item.icon, label: item.name };
  });
}
