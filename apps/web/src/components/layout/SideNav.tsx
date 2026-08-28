import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMatchMenu, getNavMenuItems, MENU_ITEMS } from './menu';

const { Sider } = Layout;
const storageKey = 'ledger:sidebar-collapsed';

export default function SideNav({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => !mobile && window.localStorage.getItem(storageKey) === 'true',
  );
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  // 导航后自增，强制重建 Menu，清空 rc-menu 的 hover 弹窗状态，
  // 避免点击选中子菜单后鼠标仍 hover 父级导致弹窗"关闭又重开"闪烁
  const [menuKey, setMenuKey] = useState(0);

  // 路由匹配链（antd pro matchMenuKeys）：叶子 = selectedKeys，父级 = 展开态自动展开
  const matchMenuKeys = useMemo(
    () => getMatchMenu(location.pathname).map((item) => item.key),
    [location.pathname],
  );
  const selectedKeys = matchMenuKeys.slice(-1);
  const parentKeys = matchMenuKeys.slice(0, -1);

  // 展开态自动展开当前路由父级（antd pro：路由变化时 setOpenKeys(matchMenuKeys)）
  useEffect(() => {
    if (!collapsed && parentKeys.length) {
      setOpenKeys((prev) => Array.from(new Set([...prev, ...parentKeys])));
    }
  }, [collapsed, parentKeys.join('|')]);

  const items = useMemo(() => getNavMenuItems(MENU_ITEMS), []);

  const onClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
    setMenuKey((k) => k + 1); // 重建 Menu，清空 hover 弹窗状态，避免导航后弹窗重开闪烁
    onNavigate?.();
  };

  // 折叠态 openKeys 完全非受控（antd pro 逻辑）：hover 弹窗由 rc-menu 内部管理，
  // 不传 openKeys/onOpenChange，避免受控状态下旧父级延迟移除导致双弹窗/残留。
  const menu = (
    <Menu
      key={menuKey}
      mode={collapsed && !mobile ? 'vertical' : 'inline'}
      inlineIndent={16}
      selectedKeys={selectedKeys}
      {...(collapsed && !mobile ? {} : { openKeys, onOpenChange: setOpenKeys })}
      items={items}
      onClick={onClick}
      // 悬浮到父级立即展示子菜单弹窗（antd pro 默认 openDelay 0.1s 有延迟感）
      subMenuOpenDelay={0}
    />
  );

  if (mobile) {
    return <nav aria-label="主导航">{menu}</nav>;
  }

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (next) setOpenKeys([]); // 收起时清空展开态残留的父级展开
    window.localStorage.setItem(storageKey, String(next));
  };

  return (
    <Sider
      width={220}
      collapsedWidth={64}
      collapsed={collapsed}
      trigger={null}
      className="app-sider"
      style={{ background: 'var(--surface)' }}
    >
      <nav aria-label="主导航">{menu}</nav>
      <button
        type="button"
        className={`sidebar-collapse-trigger${collapsed ? ' sidebar-collapse-trigger--collapsed' : ''}`}
        aria-label={collapsed ? '展开导航' : '收起导航'}
        onClick={toggleCollapsed}
      >
        {collapsed ? <RightOutlined /> : <LeftOutlined />}
      </button>
    </Sider>
  );
}
