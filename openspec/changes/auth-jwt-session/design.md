# Design: auth-jwt-session

## Architecture

```
┌──────────────────────────────────────────────────┐
│ Frontend (Vite React)                            │
│                                                  │
│  AuthContext (user, token, login/logout/refresh) │
│       ↓                                          │
│  api.ts (fetch wrapper + refresh interceptor)    │
│       ↓                                          │
│  Route Guard → <Navigate to="/login" />          │
└──────────────────┬───────────────────────────────┘
                   │ HTTP (Authorization: Bearer)
┌──────────────────▼───────────────────────────────┐
│ Backend (NestJS)                                 │
│                                                  │
│  JwtAuthGuard (global)                           │
│       ↓                                          │
│  JwtStrategy → validate(payload)                 │
│       ├── Check Redis blacklist (jti)            │
│       └── Return {id, username, role}            │
│                                                  │
│  AuthController                                  │
│  ├── POST /api/auth/login    → AuthService       │
│  ├── POST /api/auth/logout   → AuthService       │
│  ├── POST /api/auth/refresh  → AuthService       │
│  └── GET  /api/auth/session  → AuthService       │
│                                                  │
│  AuthService                                     │
│  ├── bcrypt.compare() for password               │
│  ├── JwtService.sign() for accessToken (15m)     │
│  ├── JwtService.sign() for refreshToken (7d)     │
│  ├── Redis: refresh:{userId}:{jti}               │
│  └── Redis: blacklist:{jti} (logout)             │
└──────────────────┬───────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    PostgreSQL            Redis
    (User table)       (token blacklist
                        + refresh tokens)
```

## Data Flow

### Login
```
Client                    Server                    DB/Redis
  │  POST /api/auth/login   │                         │
  │  {username, password}   │                         │
  │────────────────────────→│                         │
  │                         │  Prisma findFirst(user) │
  │                         │────────────────────────→│
  │                         │  ← User row             │
  │                         │  bcrypt.compare(pw, hash)│
  │                         │  JWT sign(accessToken)  │
  │                         │  JWT sign(refreshToken)  │
  │                         │  Redis SET refresh:{uid}:{jti} │
  │  ← 200 {accessToken}    │                         │
  │  ← Set-Cookie:          │                         │
  │     refreshToken=xxx;   │                         │
  │     HttpOnly; SameSite= │                         │
  │     Strict; Path=/api/  │                         │
  │     auth; Max-Age=604800│                         │
  │  store accessToken in   │                         │
  │  memory (AuthContext)   │                         │
```

### Authenticated Request
```
Client                    Server                    Redis
  │  GET /api/xxx           │                         │
  │  Authorization: Bearer..│                         │
  │────────────────────────→│                         │
  │                         │  JwtStrategy.validate() │
  │                         │  Redis GET blacklist:{jti} │
  │                         │────────────────────────→│
  │                         │  ← null (not revoked)   │
  │                         │  return {id,username,role}│
  │  ← 200 data             │                         │
```

### Token Refresh
```
Client (401 received)      Server                    Redis
  │  POST /api/auth/refresh │                         │
  │  Cookie: refreshToken=..│                         │
  │  (credentials: 'include')                        │
  │────────────────────────→│                         │
  │                         │  从 Cookie 解析 refresh │
  │                         │  JWT verify(refresh)    │
  │                         │  Redis GET refresh:{uid}:{jti} │
  │                         │  Redis DEL old refresh  │
  │                         │  Issue new token pair   │
  │                         │  Redis SET refresh:{uid}:{newJti} │
  │  ← 200 {accessToken}    │                         │
  │  ← Set-Cookie:          │                         │
  │     refreshToken=new;   │                         │
  │     HttpOnly...         │                         │
  │  retry original request │                         │
```

## Component Tree (Frontend)

```
App
├── AuthProvider (context: user, accessToken, login, logout, refresh)
│   ├── <Routes>
│   │   ├── /login → LoginPage (public)
│   │   └── /* → ProtectedRoute
│   │       └── Dashboard / OrderList / MasterData / ...
```

## Key Design Decisions

1. **JWT over session cookies**: 前后端分离架构 + Nginx 反向代理，JWT 通过 Authorization Header 传递无需服务端 session
2. **Redis blacklist over short TTL**: Access Token 15min 有效期短但不可撤销，通过 blacklist 实现登出后立即失效
3. **Refresh token rotation**: 每次刷新后旧 refresh token 作废，防止重放攻击
4. **httpOnly cookie for refreshToken**：Nginx 反向代理使 SPA 与 API 同域（localhost:80），因此可以使用 httpOnly Cookie 传递 refreshToken。accessToken 仍通过 Authorization Header 传递（15min 短有效期控制风险窗口），refreshToken 通过 httpOnly + SameSite=Strict Cookie 下发，前端 JS 不可读取，防御 XSS 窃取。登出时后端主动 Set-Cookie 清空 refreshToken。
5. **并发 refresh 去重**：多个请求同时触发 401 时，前端 api.ts 内部维护一个全局的唯一 refresh Promise。第一个 401 触发实际 refresh 调用，后续并发的 401 共享同一个 Promise 结果，避免重复请求导致 refreshToken rotation 冲突。

6. **Redis 不可用的降级**：JwtStrategy 在检查 blacklist 时若 Redis 不可达，采用 fail-open 策略（放行已通过 JWT 签名验证的 Token），同时通过 NestJS Logger 输出 warning 级别日志。此策略适合内部管理后台场景；如需更严格的控制，可通过环境变量 `AUTH_REDIS_FAIL_CLOSED=true` 切换为拒绝模式。

7. **Seed not migration**：用户初始化通过 seed 脚本而非 Prisma migration，支持重复执行（upsert 幂等）
