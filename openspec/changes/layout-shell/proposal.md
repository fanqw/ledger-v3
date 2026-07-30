# Proposal: layout-shell

## Summary

实现工作区的布局壳层：分组侧边栏导航（SideNav）、顶栏（TopBar）、面包屑、主题切换、响应式布局。使用 shadcn/ui 组件体系，对齐 Pencil UI 设计稿。

## Motivation

P1 完成了登录认证，但登录后只有占位文本页面。需要建立统一的工作区壳层，为后续所有业务页面提供一致的导航框架。

## Scope

### In Scope
- 侧边栏 SideNav（分组菜单：仪表台 / 订单管理 / 物料管理，含子菜单）
- 侧边栏收起/展开（图标模式 ↔ 完整菜单，localStorage 持久化）
- 顶栏 TopBar（面包屑 + 用户名/Avatar + 登出按钮）
- 面包屑导航（与侧边栏分组一致）
- Light/Dark 主题切换
- 响应式布局（≥1280px 完整布局，<1280px 侧边栏默认收起）
- shadcn/ui 基础组件补齐（Button、Input 已创建；新增 Tooltip、Avatar、Separator）

### Out of Scope
- 业务页面内容（仪表台、订单管理等留给 Phase 3-5）
- 用户个人信息编辑
- 移动端自适应（仅确保平板可用，不做移动端专门适配）

## Impact

| 层 | 变更 |
|----|------|
| Frontend | 新增 `components/layout/`（SideNav、TopBar、AppShell） |
| Frontend | 新增 shadcn/ui 组件（Tooltip、Avatar、Separator） |
| Frontend | 修改 `App.tsx`（引入 ThemeProvider + AppShell 布局） |
| Frontend | 新增 `lib/theme.tsx`（主题 Context） |
| Backend | 无变更 |
| Shared | 无变更 |

## Risks

- 主题切换需 Tailwind `darkMode: 'class'`，已配置完成
- 收起状态持久化依赖 localStorage，无后端依赖
