# Tasks: auth-jwt-session

## Task 1: Backend Auth Module

- 创建 `apps/server/src/modules/auth/` 目录
- 实现 `AuthService`（login/logout/refresh/session + bcrypt + JWT + Redis）
- 实现 `JwtStrategy`（Passport + blacklist 检查 + Redis 不可用时 fail-open 降级）
- 实现 `JwtAuthGuard`（全局守卫，`@Public()` 装饰器豁免 `/api/auth/*` 和 `/api/health`）
- 实现 `AuthController`（4 个端点，Zod 校验 login body）
- 实现 `@Public()` 装饰器（标记公开端点）
- refreshToken 使用 httpOnly Cookie 下发与读取（`@Res({ passthrough: true })`）
- 登出时清除 refreshToken Cookie
- 实现并发 refresh 去重（Redis 原子操作 DEL + SET 保证旧 token 一次性失效）
- 实现 Redis 不可用时的 fail-open 降级（Logger.warning + 放行，可通过 `AUTH_REDIS_FAIL_CLOSED=true` 环境变量切换为拒绝模式）
- 更新 `RedisService`（暴露 `client` getter，支持 `scan` 方法用于按 pattern 遍历 key，避免阻塞）
- 更新 `AppModule`（引入 AuthModule + APP_GUARD）

**Spec coverage**: Requirements 1-6

## Task 2: User Seed Script

- 创建 `apps/server/prisma/seed-users.yaml`
- 创建 `apps/server/prisma/seed.ts`（读取 YAML，bcrypt 加密，Prisma upsert）
- 确认 `apps/server/package.json` 中 `db:seed` 的 ts-node 依赖已安装（ts-node 作为 devDependencies）
- 实现 `pnpm --filter server db:create-user --username xxx --password xxx --role admin` CLI（对应 spec Requirement 7 的 CLI 场景）

**Spec coverage**: Requirement 7

## Task 3: Frontend Login Page

- 创建 `apps/web/src/pages/Login.tsx`（用户名/密码输入框 + 登录按钮）
- Tailwind 样式（居中卡片布局，错误提示）
- 登录成功后 accessToken 存内存（AuthContext state），refreshToken 由浏览器自动管理（httpOnly Cookie）
- 登录成功跳转 `/dashboard`

**Spec coverage**: Requirement 1 (client side)

## Task 4: Frontend Auth State + API Client

- 创建 `apps/web/src/lib/auth.tsx`（AuthContext: user, accessToken, login, logout, refresh）
  - login: POST /api/auth/login → 存 accessToken 到 state
  - logout: POST /api/auth/logout → 清空 state，清除 refreshToken Cookie
  - refresh: POST /api/auth/refresh（credentials: 'include'）→ 更新 state
  - 初始化时 GET /api/auth/session 判定登录状态（loading → authenticated / unauthenticated）
- 创建 `apps/web/src/lib/api.ts`（fetch wrapper）
  - 自动注入 Authorization: Bearer <accessToken>
  - 401 时触发 refresh（全局唯一 Promise 去重），成功后重试原请求
  - refresh 失败 → 清除状态、跳转 /login
- AuthProvider 包裹 App

**Spec coverage**: Requirements 2-5 (client side)

## Task 5: Frontend Route Protection

- 更新 `apps/web/src/App.tsx`（添加 /login 路由，ProtectedRoute 组件）
- 未登录访问 `/` 或 `/dashboard` → 重定向到 `/login`
- 已登录访问 `/login` → 重定向到 `/dashboard`
- ProtectedRoute 在 AuthContext 处于 loading 状态时显示 loading indicator（避免闪烁）
- App.tsx 挂载时调用 AuthContext 的初始化（GET /api/auth/session）

**Spec coverage**: Requirement 2 (client side)

## Task 6: Docker Rebuild + Verification

- 重新构建 NestJS（`docker compose build server`）
- 构建前端静态文件（`vite build`）
- `docker compose up -d`
- `prisma migrate deploy` + `pnpm db:seed`
- 验证清单:
  - [ ] `POST /api/auth/login` 正确凭据 → 返回 accessToken + Set-Cookie refreshToken
  - [ ] `POST /api/auth/login` 错误凭据 → 401 INVALID_CREDENTIALS
  - [ ] `GET /api/auth/session` 无 Token → 401
  - [ ] `GET /api/auth/session` 有效 Token → 200 {id, username, role}
  - [ ] `POST /api/auth/logout` → 成功，后续请求被拒，refreshToken Cookie 被清除
  - [ ] `POST /api/auth/refresh` 有效 Cookie → 新 accessToken + 新 refreshToken Cookie
  - [ ] `POST /api/auth/refresh` 过期 Cookie → 401
  - [ ] 并发 3 个 401 请求仅触发 1 次 /api/auth/refresh
  - [ ] Redis 宕机时已登录用户仍可正常访问 API（fail-open）
  - [ ] `db:seed` 幂等：重复执行不产生重复用户
  - [ ] `db:create-user` CLI 可正常创建/更新用户
  - [ ] 前端登录页渲染正常
  - [ ] 前端登录成功 → 跳转 /dashboard
  - [ ] 前端未登录访问 /dashboard → 重定向 /login
  - [ ] 前端登出 → 清除状态，跳转 /login
  - [ ] 控制台无报错

## Task 7: 测试

- 后端 AuthService 单元测试（login/logout/refresh/session 正常与异常路径）
- 后端 JwtStrategy 单元测试（有效 token / 过期 token / 黑名单 token / Redis 不可用）
- 后端 E2E 测试（POST /api/auth/login → 200 / 401，完整登录→访问→登出→拒绝流程）
- 前端 AuthContext 逻辑测试（login/logout/refresh 状态迁移）
- 前端 api.ts refresh 拦截器测试（并发 401 去重）
