# admin-authentication

## Purpose

定义用户认证与会话管理的行为规格，包括 JWT 双令牌登录/登出/刷新、Token 黑名单、全局鉴权守卫。


## Requirements

### Requirement: 用户使用用户名与密码登录

系统 SHALL 允许持有有效凭据的用户通过用户名与密码完成认证，返回 JWT Access Token 和 Refresh Token。

#### Scenario: 凭据正确时登录成功

- WHEN 客户端使用数据库中存在的用户名与正确密码提交 POST /api/auth/login
- THEN 系统 SHALL 返回 HTTP 200，响应体 JSON 包含 accessToken；refreshToken 通过 Set-Cookie 下发（httpOnly, SameSite=Strict, Path=/api/auth）
- THEN refreshToken SHALL 以 httpOnly Cookie 形式下发（SameSite=Strict）

#### Scenario: 凭据错误时登录失败

- WHEN 客户端使用错误密码或不存在的用户名提交登录请求
- THEN 系统 SHALL 返回 HTTP 401，错误码为 INVALID_CREDENTIALS，错误提示为"用户名或密码错误"
- THEN 系统 SHALL NOT 泄露用户是否存在的敏感信息

### Requirement: 未认证访问受保护资源被拒绝

系统 SHALL 确保未登录用户无法执行业务操作或访问需认证的 API。

#### Scenario: 未携带 Token 访问受保护 API

- WHEN 未携带 Authorization Header 的请求访问 /api/* 下除 auth 和 health 之外的任意端点
- THEN 系统 SHALL 返回 HTTP 401
- THEN 系统 SHALL NOT 返回业务数据

#### Scenario: 携带过期 Token 访问受保护 API

- WHEN 客户端使用已过期的 accessToken 访问受保护 API
- THEN 系统 SHALL 返回 HTTP 401，错误码为 TOKEN_EXPIRED，提示"登录已过期，请重新登录"

#### Scenario: 携带已撤销 Token 访问受保护 API

- WHEN 客户端使用已被加入 Redis 黑名单的 accessToken（如登出后的 Token）访问受保护 API
- THEN 系统 SHALL 返回 HTTP 401，错误码为 TOKEN_REVOKED，提示"令牌已失效"

### Requirement: 用户可登出

系统 SHALL 提供登出能力，使当前 accessToken 失效。

#### Scenario: 登出后 Token 失效

- WHEN 已登录用户执行 POST /api/auth/logout，并在 Authorization Header 携带有效 accessToken
- THEN 系统 SHALL 将该 accessToken 的 jti 加入 Redis 黑名单，TTL 为 Token 剩余有效期
- THEN 系统 SHALL 清除客户端的 refreshToken Cookie
- THEN 随后使用该 accessToken 访问受保护 API SHALL 被拒绝

### Requirement: Token 刷新

系统 SHALL 允许用户使用 refreshToken 获取新的 accessToken，无需重新登录。

#### Scenario: 使用有效 refreshToken 刷新

- WHEN 客户端在 accessToken 过期后，携带有效的 refreshToken Cookie 请求 POST /api/auth/refresh
- THEN 系统 SHALL 返回新的 accessToken（15min）和新的 refreshToken（7d）
- THEN 旧的 refreshToken SHALL 失效

#### Scenario: 使用过期 refreshToken 刷新失败

- WHEN 客户端使用已过期的 refreshToken 请求刷新
- THEN 系统 SHALL 返回 HTTP 401，错误码为 TOKEN_EXPIRED

### Requirement: 获取当前用户信息

系统 SHALL 允许已登录用户查询当前会话的用户信息。

#### Scenario: 查询当前用户

- WHEN 已登录用户请求 GET /api/auth/session
- THEN 系统 SHALL 返回 HTTP 200，响应体包含当前用户的 id、username、role

### Requirement: 全局鉴权守卫

系统 SHALL 通过 NestJS JwtAuthGuard 保护所有 /api/* 端点（除 /api/auth/* 和 /api/health 外），确保每个请求都经过身份验证。

#### Scenario: /api/health 无需认证

- WHEN 客户端请求 GET /api/health 不带任何认证信息
- THEN 系统 SHALL 返回 HTTP 200，响应体包含数据库和 Redis 连通性状态

#### Scenario: /api/auth/* 无需认证

- WHEN 客户端请求 POST /api/auth/login 或 POST /api/auth/refresh 不带 Authorization Header
- THEN 系统 SHALL 正常处理请求，不因缺少 Token 而拒绝
### Requirement: 用户批量初始化

系统 SHALL 支持通过 seed 脚本从 YAML 配置文件批量创建用户。seed 脚本以 YAML 中 username 为唯一键执行 upsert（已有用户更新密码，新用户插入），不删除已有用户。

#### Scenario: 从 YAML 文件批量创建用户

- WHEN 执行 `pnpm --filter server prisma db seed`，且 `apps/server/prisma/seed-users.yaml` 包含多条用户记录
- THEN 系统 SHALL 读取 YAML 文件中的 users 数组，对每条记录以 username 为键执行 upsert
- THEN 已有用户的 passwordHash SHALL 被更新为新密码的 bcrypt 哈希
- THEN 不存在的用户 SHALL 被创建，role 默认设为 "admin"

#### Scenario: CLI 手动创建用户

- WHEN 执行 `pnpm --filter server db:create-user --username xxx --password xxx --role admin`
- THEN 系统 SHALL 以 username 为键执行 upsert，行为与 seed 脚本一致

#### Scenario: seed 脚本不删除已有用户

- WHEN seed 脚本重复执行，且 YAML 中移除某个用户
- THEN 被移除的用户 SHALL NOT 被删除（seed 只做 upsert，不删除）


