## ADDED Requirements

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
