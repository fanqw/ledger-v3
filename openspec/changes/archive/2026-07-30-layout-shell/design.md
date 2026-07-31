# Design: layout-shell

## Visual Design Constants（来自 Pencil UI 设计稿）

| 元素 | 属性 | 值 |
|------|------|-----|
| SideNav 背景 | bg | `#F1F5F9` |
| SideNav 宽度 | w | `240px`（收起 `64px`） |
| SideNav 内边距 | p | `24px 16px` |
| SideNav 子项间距 | gap | `4px` |
| Logo 文字 | text | `18px` bold `#0F172A` |
| NavItem 默认 | text | `13px` medium `#475569` |
| NavItem 高亮 | bg+text | `bg-[#3B82F6]` + `text-white` font-semibold |
| NavItem hover | bg | `bg-[#3B82F6]/10`（10% opacity） |
| NavItem 图标 | size | `18px × 18px` (lucide) |
| NavItem 内边距 | p | `8px`，gap `8px` |
| Section 标题 | text | `11px` font-semibold `#94A3B8` |
| 分隔线 | bg+h | `bg-[#E2E8F0]` `1px` |
| TopBar 高度 | h | `56px`（`p-[16px_24px]`） |
| TopBar 下边框 | border | `1px solid #E2E8F0` |
| 页面标题 | text | `18px` bold `#0F172A` |
| 用户名称 | text | `13px` medium `#475569` |
| Avatar 尺寸 | w×h | `32px × 32px` |
| Avatar 背景 | bg | `#3B82F6` |
| Avatar 文字 | text | `14px` font-semibold `#FFFFFF` |
| Avatar 圆角 | rounded | `16px`（full circle） |
| Avatar fallback | 逻辑 | 取 `username` 首字母大写 |

### 暗色模式额外配色

| 元素 | Light | Dark |
|------|-------|------|
| Body 背景 | `#F8FAFC` | `#0F172A` |
| SideNav 背景 | `#F1F5F9` | `#1E293B` |
| SideNav 文字 | `#475569` | `#CBD5E1` |
| NavItem hover | `bg-[#3B82F6]/10` | `bg-[#3B82F6]/20` |
| 分隔线 | `#E2E8F0` | `#334155` |
| TopBar 背景 | `#FFFFFF` | `#0F172A` |
| TopBar 边框 | `#E2E8F0` | `#1E293B` |
| 主内容区背景 | `#F8FAFC` | `#0F172A` |

## Architecture

```
AppShell
├── SideNav (240px, sticky top-0 h-screen, collapsible → 64px)
│   ├── Logo Row
│   ├── NavSection "仪表台"
│   │   └── NavItem "仪表台" (layout-dashboard icon)
│   ├── Divider
│   ├── NavSection "订单"
│   │   └── NavItem "订单管理" (file-text icon)
│   ├── Divider
│   ├── NavSection "物料管理"
│   │   ├── NavItem "商品分类"
│   │   ├── NavItem "商品单位"
│   │   ├── NavItem "商品信息"
│   │   └── NavItem "进货地"
│   └── Collapse Button
│
└── Main Content Area (flex-1, overflow-y-auto)
    ├── TopBar (sticky top-0, h-14, bg-white, border-b)
    │   ├── Breadcrumb
    │   └── TopRight
    │       ├── Theme Toggle (Sun/Moon icon)
    │       ├── Username
    │       ├── Avatar (首字母)
    │       └── Logout Button
    └── Page Content (<Outlet />, p-6)
```

## Component Tree

```
App
├── ThemeProvider
│   └── AuthProvider
│       └── <Routes>
│           ├── /login → LoginPage
│           └── /* → ProtectedRoute
│               └── AppShell
│                   ├── SideNav
│                   ├── TopBar
│                   └── <Outlet> (page content)
```

## SideNav States

| State | Width | Menu Display | Behavior |
|-------|-------|-------------|----------|
| Expanded (default ≥1280px) | 240px | Icon + Label | NavLink 精确匹配高亮（`end` prop） |
| Collapsed (<1280px or manual) | 64px | Icon only + Tooltip | 父级 NavSection 不高亮 |
| Active item | — | `bg-[#3B82F6] text-white font-semibold` | 仅匹配精确路由（NavLink `end`） |

Collapse toggle persisted in localStorage key `ledger:sidebar-collapsed`.

## Theme System

- Tailwind `darkMode: 'class'`
- `<html class="dark">` toggled by ThemeProvider
- 首次访问无 localStorage 值时，fallback 到系统 `prefers-color-scheme` 媒体查询
- Preference stored in localStorage key `ledger:theme` (`"light"` | `"dark"`)

## Route ↔ Breadcrumb Mapping

| Route | Breadcrumb | Implementation |
|-------|-----------|:---:|
| /dashboard | 仪表台 | P2 |
| /orders | 仪表台 / 订单管理 / 订单列表 | P2 |
| /orders/:id | 仪表台 / 订单管理 / 订单详情 | P3+ |
| /categories | 仪表台 / 物料管理 / 商品分类 | P2 |
| /units | 仪表台 / 物料管理 / 商品单位 | P2 |
| /commodities | 仪表台 / 物料管理 / 商品信息 | P2 |
| /purchase-places | 仪表台 / 物料管理 / 进货地 | P2 |
