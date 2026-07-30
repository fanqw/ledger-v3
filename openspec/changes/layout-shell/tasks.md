# Tasks: layout-shell

## Task 1: shadcn/ui 基础组件

- 创建 `apps/web/src/components/ui/tooltip.tsx`
- 创建 `apps/web/src/components/ui/avatar.tsx`
- 创建 `apps/web/src/components/ui/separator.tsx`

## Task 2: 主题系统

- 创建 `apps/web/src/lib/theme.tsx`（ThemeProvider, ThemeContext）
- 支持 light/dark 切换，状态持久化到 localStorage key `ledger:theme`
- 首次访问无 localStorage 值时，fallback 到系统 `prefers-color-scheme` 偏好
- 切换时在 `<html>` 元素上添加/移除 `dark` class
- 确保所有组件对暗色模式配色使用 Tailwind `dark:` utility classes（参考 design.md 暗色模式配色表添加 `dark:bg-*`、`dark:text-*` 等 variant）

## Task 3: SideNav 侧边栏

- 创建 `apps/web/src/components/layout/SideNav.tsx`
- 分组导航：仪表台 / 订单管理（订单列表）/ 物料管理（商品分类、商品单位、商品信息、进货地）
- 当前路由高亮：`bg-[#3B82F6] text-white font-semibold`，使用 `NavLink` 的 `end` prop 精确匹配
- 收起/展开按钮，状态持久化 localStorage key `ledger:sidebar-collapsed`
- 收起状态下（64px）：仅显示图标 + Tooltip 显示完整名称；NavItem 图标水平居中（`justify-center`）
- SideNav 设为 `sticky top-0 h-screen`，防止长页面滚动时跟随
- 匹配 Pencil UI 设计稿：`bg-[#F1F5F9]`、`p-[24px_16px]`、`gap-[4px]`、lucide 图标 `18px`；暗色模式添加 `dark:bg-[#1E293B]`、`dark:text-[#CBD5E1]`（完整对照见 design.md 暗色模式表）
- Section 标题：`text-[11px] font-semibold text-[#94A3B8]`

## Task 4: TopBar 顶栏 + 面包屑

- 创建 `apps/web/src/components/layout/TopBar.tsx`
- TopBar 设为 `sticky top-0 h-14 bg-white border-b border-[#E2E8F0]`；暗色模式添加 `dark:bg-[#0F172A] dark:border-[#1E293B]`
- 面包屑导航：基于当前路由自动生成，参考 design.md Route↔Breadcrumb 映射表
- 右侧：主题切换按钮（Sun/Moon icon）+ 用户名 + Avatar（`username` 首字母大写，`bg-[#3B82F6]`，`w-8 h-8 rounded-full`）+ 登出按钮
- 用户信息从 `useAuth()` 获取

## Task 5: AppShell 布局壳

- 创建 `apps/web/src/components/layout/AppShell.tsx`
- 组合 SideNav + TopBar + `<Outlet />`
- 主内容区 `overflow-y-auto`
- 响应式：≥1280px 侧边栏展开，<1280px 默认收起
- 更新 `App.tsx`：**ThemeProvider 包裹 AuthProvider**（保证登录页也支持主题切换），ProtectedRoute 内使用 AppShell

## Task 6: 构建 + 验证

- `vite build` 构建通过
- 验证清单:
  - [ ] 登录后看到完整 SideNav + TopBar + 占位内容区
  - [ ] 侧边栏点击导航切换路由
  - [ ] 侧边栏收起/展开，刷新后保持状态
  - [ ] 面包屑随路由变化正确显示
  - [ ] 主题切换 light ↔ dark，刷新后保持
  - [ ] 首次访问无 localStorage 时，fallback 到系统主题偏好
  - [ ] 暗色模式下 SideNav 和 TopBar 渲染正常（颜色符合 design.md 暗色模式表）
  - [ ] 窗口缩放到 <1280px，侧边栏自动收起
  - [ ] 长页面滚动时 SideNav 和 TopBar 不跟随（sticky）
  - [ ] Avatar 显示用户名首字母
  - [ ] 登出按钮可用
  - [ ] 控制台无报错
