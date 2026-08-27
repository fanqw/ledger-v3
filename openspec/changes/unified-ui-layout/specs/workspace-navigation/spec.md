## MODIFIED Requirements

### Requirement: 侧边栏收起展开

侧边栏 SHALL 支持在窄图标模式与完整菜单模式之间切换，并持久化用户选择；手机端 SHALL 使用抽屉导航而非压缩主内容区。

#### Scenario: 桌面侧边栏可收起与展开

- **WHEN** 用户在不小于 768px 的视口点击收起或展开按钮
- **THEN** 侧边栏 SHALL 在 64px 窄图标模式与完整菜单模式之间切换
- **THEN** 刷新页面 SHALL 保持用户上次选择

#### Scenario: 首次进入桌面工作区

- **WHEN** 用户在不小于 1280px 的视口首次进入且没有已持久化选择
- **THEN** 侧边栏 SHALL 默认显示 64px 窄图标模式
- **THEN** 每个图标导航项 SHALL 提供可访问名称或提示

#### Scenario: 手机打开导航

- **WHEN** 用户在小于 768px 的视口点击顶栏菜单按钮
- **THEN** 系统 SHALL 以抽屉形式显示完整分组导航
- **THEN** 主内容区宽度 SHALL 不因导航打开前的占位而缩小

### Requirement: 响应式布局

系统 SHALL 在桌面端（≥1280px）提供窄侧栏、顶栏和主内容区布局；在平板端保留可用的窄侧栏；在手机端使用顶栏与抽屉导航，并确保核心操作不被遮挡。

#### Scenario: 桌面端完整布局

- **WHEN** 用户在不小于 1280px 的浏览器中访问
- **THEN** 侧边栏 SHALL 默认使用窄图标模式且允许展开
- **THEN** 主内容区 SHALL 占据除侧边栏外的剩余宽度

#### Scenario: 平板端可用

- **WHEN** 用户在 768px 至 1279px 宽度的视口访问
- **THEN** 侧边栏 SHALL 使用窄图标模式
- **THEN** 侧边栏、顶栏、主内容区 SHALL 不遮挡页面主操作入口

#### Scenario: 手机端可用

- **WHEN** 用户在小于 768px 的视口访问
- **THEN** 固定侧边栏 SHALL 从正常布局中移除
- **THEN** 顶栏 SHALL 提供打开抽屉导航的按钮、产品标识和用户入口

### Requirement: 工作区布局壳

系统 SHALL 提供 SideNav、TopBar 和主内容区组成的统一布局壳，并通过应用级主题 token 统一背景、边框、文字层级、圆角和品牌强调色。

#### Scenario: 登录后进入桌面布局壳

- **WHEN** 用户登录成功后在不小于 768px 的视口访问任意业务页面
- **THEN** 页面 SHALL 显示左侧 SideNav、顶部 TopBar 和占据剩余空间的主内容区
- **THEN** SideNav 在窄模式下 SHALL 为 64px 宽

#### Scenario: 登录后进入手机布局壳

- **WHEN** 用户登录成功后在小于 768px 的视口访问任意业务页面
- **THEN** 页面 SHALL 显示移动 TopBar 和占满可用宽度的主内容区
- **THEN** SideNav SHALL 仅在用户打开导航抽屉时出现

#### Scenario: 工作区使用统一主题层级

- **WHEN** 用户在不同业务页面之间导航
- **THEN** 页面背景、分隔线、主要文字、次要文字和主操作 SHALL 使用相同的应用级主题 token
