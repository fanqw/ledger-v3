# Proposal: auth-jwt-session

## Summary

实现 JWT 双令牌认证系统：登录/登出/Token 刷新/Session 查询/全局鉴权守卫/用户批量初始化（seed）。

## Motivation

P0 已搭建项目骨架（NestJS + Prisma + Vite React + Docker Compose），但所有 API 端点均无认证保护。P1 需要建立完整的认证与会话体系，为后续所有业务模块提供安全基础。

## Scope

### In Scope
- 后端 Auth 模块（NestJS：Controller + Service + JWT Strategy + Guard）
- 前端登录页面
- 前端 Auth 状态管理（React Context + httpOnly Cookie）
- 前端 API 客户端（axios/fetch wrapper + token 自动刷新拦截器）
- 路由守卫（未登录重定向到登录页）
- 用户 seed 脚本（seed-users.yaml → bcrypt → upsert）
- docker-compose + migrate + seed 一键启动可登录

### Out of Scope
- 注册页面（系统不提供公开注册）
- RBAC 细粒度权限
- 第三方 OAuth 登录
- 密码修改功能

## Impact

| 层 | 变更 |
|----|------|
| Backend | 新增 `apps/server/src/modules/auth/` |
| Backend | 新增 `apps/server/prisma/seed.ts` + `seed-users.yaml` |
| Backend | 修改 `app.module.ts`（引入 AuthModule + 全局 JwtAuthGuard） |
| Backend | 修改 `RedisService`（暴露 client getter） |
| Frontend | 新增 `Login` 页面、`AuthContext`、`api` 客户端 |
| Frontend | 修改 `App.tsx`（添加路由守卫） |
| Shared | 无变更（已有 loginSchema、错误码） |

## Risks

- JWT 签名密钥使用环境变量（`JWT_SECRET`/`JWT_REFRESH_SECRET`），默认值仅用于开发
- Redis 黑名单依赖 Redis 可用性；若 Redis 不可用，无法验证已撤销 Token
- refreshToken 存储在前端 httpOnly Cookie 中，依赖 Nginx 同域代理；若 Nginx 配置错误（跨域），Cookie 无法携带
