## MODIFIED Requirements

### Requirement: 侧边栏分组导航

系统 SHALL 提供层级式侧边栏导航，包含仪表台、数据分析、订单管理和物料管理；订单管理与物料管理 SHALL 为可展开父菜单。

#### Scenario: 侧边栏按层级显示菜单

- **WHEN** 用户在桌面端进入已登录工作区
- **THEN** 侧边栏 SHALL 显示“仪表台”“数据分析”“订单管理”“物料管理”
- **THEN** “订单管理” SHALL 包含“订单列表”子菜单
- **THEN** “物料管理” SHALL 包含“商品分类”“商品单位”“商品信息”“进货地”子菜单

#### Scenario: 当前页面菜单项高亮并展开父菜单

- **WHEN** 用户访问某个子页面（如“商品信息”）
- **THEN** 对应子菜单项 SHALL 以高亮样式显示
- **THEN** 所属父菜单 SHALL 自动展开

### Requirement: 侧边栏收起展开

侧边栏 SHALL 支持在 220px 完整菜单模式与 64px 图标模式之间切换，并持久化用户选择。

#### Scenario: 首次进入桌面默认展开

- **WHEN** 用户在桌面端首次进入且没有已保存的侧栏偏好
- **THEN** 侧边栏 SHALL 以 220px 完整菜单模式显示

#### Scenario: 使用边界按钮收起与展开

- **WHEN** 用户点击侧栏右边界顶部的圆形收起或展开按钮
- **THEN** 侧边栏 SHALL 在 220px 与 64px 宽度之间切换
- **THEN** 按钮箭头和无障碍名称 SHALL 表达下一步操作

#### Scenario: 刷新后保持折叠状态

- **WHEN** 用户切换侧栏状态后刷新页面
- **THEN** 系统 SHALL 从 `ledger:sidebar-collapsed` 恢复上次状态

### Requirement: 响应式布局

系统 SHALL 在不小于 992px 的视口显示可折叠桌面侧栏，在小于 992px 的视口移除桌面侧栏并使用抽屉导航。

#### Scenario: 桌面端完整布局

- **WHEN** 用户在不小于 992px 的浏览器中访问
- **THEN** 系统 SHALL 显示可折叠侧栏和占据剩余空间的主内容区

#### Scenario: 平板和手机使用抽屉

- **WHEN** 用户在小于 992px 的视口访问
- **THEN** 桌面侧栏和边界折叠按钮 SHALL 不显示
- **THEN** 顶栏 SHALL 提供具有“打开导航”无障碍名称的菜单按钮
- **THEN** 抽屉 SHALL 显示完整菜单文字和层级

### Requirement: 工作区布局壳

系统 SHALL 提供全宽 TopBar，以及其下方由 SideNav 和主内容区组成的统一布局壳。

#### Scenario: 登录后进入桌面布局壳

- **WHEN** 用户登录成功后在桌面视口访问任意业务页面
- **THEN** 页面 SHALL 显示全宽 TopBar、左侧 SideNav 和主内容区
- **THEN** SideNav 展开宽度 SHALL 为 220px，折叠宽度 SHALL 为 64px

#### Scenario: 登录后进入小屏布局壳

- **WHEN** 用户登录成功后在小于 992px 的视口访问任意业务页面
- **THEN** 页面 SHALL 显示全宽 TopBar 和占满可用宽度的主内容区
- **THEN** SideNav SHALL 仅在用户打开导航抽屉时出现
