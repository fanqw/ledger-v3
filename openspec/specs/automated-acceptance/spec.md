# automated-acceptance

## Purpose

定义自动化验收的行为规格，包括健康检查端点、Docker Compose 一键启动、E2E 冒烟测试、测试覆盖率要求。


## Purpose

定义自动化验收的行为规格，包括健康检查端点、Docker Compose 一键启动、E2E 冒烟测试、测试覆盖率要求。
# automated-acceptance

## Requirements

### Requirement: 健康检查端点

系统 SHALL 提供 GET /api/health 端点，返回数据库和 Redis 的连通性状态。

#### Scenario: 所有服务正常时返回健康

- WHEN 请求 GET /api/health
- THEN 系统 SHALL 返回 HTTP 200，响应体包含 `{ success: true, data: { db: "connected", redis: "connected", uptime: <seconds> } }`

#### Scenario: 数据库不可用时返回异常

- WHEN PostgreSQL 不可达
- THEN GET /api/health SHALL 返回 HTTP 503，响应体包含 `{ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "数据库不可用" } }`

### Requirement: Docker Compose 一键启动

系统 SHALL 支持通过 `docker compose up` 一条命令启动全部服务（PostgreSQL + Redis + backend + frontend + Nginx）。

#### Scenario: 本地环境一键启动

- WHEN 执行 `docker compose up -d`
- THEN PostgreSQL、Redis、NestJS backend、Vite frontend、Nginx 五个容器 SHALL 全部启动
- THEN GET http://localhost SHALL 返回登录页面

#### Scenario: 健康检查自动验证

- WHEN docker compose up 完成后
- THEN GET http://localhost/api/health SHALL 返回健康状态

### Requirement: 核心链路 E2E 冒烟测试

系统 SHALL 提供 Playwright E2E 冒烟测试，覆盖登录 → 基础资料 CRUD → 订单创建 → 明细添加 → 工作台查看的核心链路。

#### Scenario: 登录页冒烟

- WHEN Playwright 访问 http://localhost
- THEN 登录页 SHALL 显示用户名和密码输入框以及登录按钮

#### Scenario: 登录并跳转工作台

- WHEN 在登录页输入正确的用户名和密码并点击登录
- THEN 页面 SHALL 跳转到工作台页面
- THEN 侧边栏导航 SHALL 可见

#### Scenario: 创建分类

- WHEN 已登录用户导航到商品分类页面并创建一条新分类
- THEN 新分类 SHALL 出现在列表中

#### Scenario: 创建订单并添加明细

- WHEN 已登录用户创建一条订单并添加一条明细
- THEN 订单详情页 SHALL 显示该明细，包含分类小计和订单总计

#### Scenario: 工作台加载

- WHEN 已登录用户访问工作台
- THEN KPI 卡片和图表 SHALL 成功渲染（非空白）

### Requirement: 测试覆盖率

系统 SHALL 确保后端 Service 层的单元测试覆盖率 ≥ 60%，核心流程（认证、CRUD、关联检查）有集成测试覆盖。

#### Scenario: 运行单元测试

- WHEN 执行 pnpm --filter server test
- THEN 所有 Service 的单元测试 SHALL 通过
- THEN 覆盖率报告 SHALL 显示 ≥ 60%

#### Scenario: 运行 E2E 冒烟测试

- WHEN 执行 pnpm --filter web smoke:e2e
- THEN 核心链路的冒烟测试 SHALL 全部通过
