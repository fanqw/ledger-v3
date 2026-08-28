## Why

当前菜单栏虽然具备基础折叠能力，但菜单分组不可展开、折叠入口位于底部且状态不持久化，与用户指定的 Ant Design Pro 参考结构差异明显。需要统一导航层级、折叠交互和响应式行为，让桌面导航更清晰且不破坏平板与手机体验。

## What Changes

- 桌面侧栏首次进入默认展开，宽度调整为 220px，折叠后保持 64px 图标模式。
- 将订单管理和物料管理改为可展开的真实子菜单，当前路由自动展开所属父菜单。
- 将折叠入口移动到侧栏与内容区交界的顶部圆形按钮，并提供明确的左右箭头和无障碍名称。
- 将桌面折叠状态持久化到 `ledger:sidebar-collapsed`，刷新后恢复。
- 平板和手机继续使用完整文字的抽屉菜单，不继承桌面折叠状态。
- 修复当前 Web 布局契约与后续页面结构不一致的问题，并补充移动菜单按钮的无障碍名称。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace-navigation`: 明确桌面菜单层级、220/64px 展开收起行为、边界触发器、状态持久化及小屏抽屉规则。

## Impact

- 修改 `apps/web/src/components/layout/menu.tsx`、`SideNav.tsx`、`TopBar.tsx` 和 `index.css`。
- 更新 `apps/web/scripts/ui-layout-contract.test.mjs`，使契约与当前页面结构和新导航行为一致。
- 不改变现有路由、API、权限、主题、账户菜单或业务数据结构。
