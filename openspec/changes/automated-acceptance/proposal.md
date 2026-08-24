## Why

P0-P5 已全部落地（骨架→认证→布局→基础资料→订单→工作台），但项目尚不可交付：无 docker-compose 前端服务、测试覆盖率仅 24.55%（要求 ≥60%）、E2E 冒烟不完整、无 README/部署/API 文档。P7 是执行计划收尾阶段，补齐自动化验收与文档，使项目可一键启动、可验证、可交付。

## What Changes

- **完善 Docker Compose 一键启动**：
  - 新增 `apps/web/Dockerfile`（Nginx 托管 Vite 构建产物）
  - `docker-compose.yml` 补 `frontend` 服务（nginx 容器服务 dist）
  - 现有 nginx.conf（/api 代理 + SPA fallback）保留复用
  - `docker compose up -d` 一条命令启动全部 5 服务（PG + Redis + backend + frontend + nginx）
- **提升后端测试覆盖率至 ≥60%**：补充 Service/Controller 层缺失的单元测试（认证、CRUD、关联检查、健康检查），`pnpm --filter server test -- --coverage` 达标
- **补齐 E2E 冒烟测试**：新增 Playwright 冒烟脚本覆盖核心链路（登录 → 基础资料 CRUD → 订单创建 → 明细添加 → 工作台查看），作为 `smoke:e2e` 命令
- **完善文档**：根目录 README.md（项目简介/架构/快速开始/命令）、部署文档、API 文档

## Capabilities

### New Capabilities

<!-- 无新 capability，automated-acceptance 主规格已存在 -->

### Modified Capabilities

- `automated-acceptance`: 本 change 落地该 capability——健康检查端点已实现但需验证完整（DB/Redis 异常分支）、Docker Compose 补齐 frontend 服务、E2E 冒烟覆盖完整链路、覆盖率达标 ≥60%

## Impact

- **部署**：新增 `apps/web/Dockerfile`、修改 `docker-compose.yml`（frontend 服务）、复用 `nginx.conf`
- **测试**：新增/补充 `apps/server/src/**/__tests__/` 单元测试（提升覆盖率）、新增 `apps/web/e2e/scripts/smoke.spec.mjs` + `smoke:e2e` 脚本
- **文档**：新增 `README.md`、`doc/部署文档.md`、`doc/API 文档.md`（或并入现有 doc/）
- **依赖**：无新增外部依赖（Playwright 已有、Nginx 镜像已有）
