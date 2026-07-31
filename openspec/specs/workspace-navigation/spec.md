# workspace-navigation

## Purpose

定义工作区布局与导航行为规格，包括侧边栏分组导航、面包屑、主题切换、响应式布局。

## Purpose

定义工作区布局与导航行为规格，包括侧边栏分组导航、面包屑、主题切换、响应式布局。
# workspace-navigation
## Requirements
### Requirement: 侧边栏分组导航

系统 SHALL 提供分组式侧边栏导航，包含以下菜单分组：

- 仪表台
- 订单：订单管理
- 物料管理：商品分类、商品单位、商品信息、进货地

#### Scenario: 侧边栏按分组显示菜单

- WHEN 用户进入已登录工作区任一页面
- THEN 侧边栏 SHALL 显示"仪表台""订单管理""物料管理"三个分组及其约定的子菜单项

#### Scenario: 当前页面菜单项高亮

- WHEN 用户访问某页面（如"商品信息"）
- THEN 侧边栏中对应的"商品信息"菜单项 SHALL 以高亮样式显示

### Requirement: 侧边栏收起展开

侧边栏 SHALL 支持收起（折叠为图标模式）与展开（完整菜单模式），状态持久化。

#### Scenario: 侧边栏可收起与展开

- WHEN 用户点击收起/展开按钮
- THEN 侧边栏 SHALL 在图标模式与完整菜单模式之间切换
- THEN 切换后刷新页面 SHALL 保持上次状态

### Requirement: 面包屑导航

页面顶部 SHALL 显示与侧边栏分组一致的面包屑路径。

#### Scenario: 访问物料管理子页面时面包屑正确

- WHEN 用户访问商品分类、商品单位、商品信息或进货地页面
- THEN 面包屑 SHALL 显示"仪表台 / 物料管理 / 对应页面名"

#### Scenario: 访问订单管理页面时面包屑正确

- WHEN 用户访问订单列表页面
- THEN 面包屑 SHALL 显示"仪表台 / 订单管理 / 订单列表"

### Requirement: 主题切换

Header 区域 SHALL 提供 light / dark 主题切换按钮，选择后持久化到 localStorage。

#### Scenario: 主题切换后刷新保持

- WHEN 用户从 light 切换到 dark 主题
- THEN 页面 SHALL 立即切换为 dark 配色
- THEN 刷新页面后 SHALL 恢复 dark 主题

### Requirement: 响应式布局

系统 SHALL 在桌面端（≥1280px）提供完整的侧边栏 + 主内容区布局；在小屏设备上侧边栏默认收起。

#### Scenario: 桌面端完整布局

- WHEN 用户在 ≥1280px 宽度的浏览器中访问
- THEN 侧边栏 SHALL 默认展开，主内容区 SHALL 占据剩余宽度

#### Scenario: 平板端可用

- WHEN 用户在平板设备（如 MatePad 11）横屏或竖屏访问
- THEN 侧边栏、顶栏、主内容区 SHALL 不遮挡核心操作入口

### Requirement: 工作区布局壳

系统 SHALL 提供 SideNav + TopBar + 主内容区的三层布局壳，作为所有业务页面的统一框架。

#### Scenario: 登录后进入布局壳

- WHEN 用户登录成功后访问任意业务页面
- THEN 页面 SHALL 显示左侧 SideNav（240px）+ 顶部 TopBar + 主内容区

### Requirement: 暗色模式

系统 SHALL 支持 light/dark 主题切换，首次访问 fallback 到系统 `prefers-color-scheme` 偏好，选择持久化到 localStorage。

#### Scenario: 主题切换并刷新保持

- WHEN 用户从 light 切换到 dark 主题
- THEN 页面 SHALL 立即切换为 dark 配色
- THEN 刷新页面后 SHALL 恢复 dark 主题

