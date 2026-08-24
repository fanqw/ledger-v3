## Context

P0-P5 已落地，项目功能完整但不可交付。P7 补齐自动化验收与文档。当前状态：
- **docker-compose.yml** 已有（nginx + postgres + redis + server），**缺 frontend 服务**
- **nginx.conf** 已有（/api 代理 + SPA fallback），server Dockerfile 已有，**web 缺 Dockerfile**
- **覆盖率 24.55%**（要求 ≥60%）。缺口分析：`analytics.controller.ts`（40%）、`order.controller.ts`（48%）缺 controller 测试；其余 service/controller 均 ≥90%
- 健康检查端点已实现（DB + Redis 连通性），但 DB 异常分支（503）未覆盖
- E2E 有 `order-detail.spec.mjs`（订单详情），但缺完整核心链路冒烟
- 无 README/部署/API 文档

## Goals / Non-Goals

**Goals:**
- `docker compose up -d` 一条命令启动全部 5 服务（PG + Redis + backend + frontend + nginx）
- 后端覆盖率 ≥60%
- E2E 冒烟覆盖核心链路（登录→CRUD→订单→工作台）
- README + 部署 + API 文档齐全

**Non-Goals:**
- 不新增外部依赖（复用现有 Playwright、Nginx、Docker 镜像）
- 不做 CI/CD 流水线（项目规模 2-3 用户，一键启动 + 测试足矣）
- 不提升到 90%+ 覆盖率（60% 达标即可，重点覆盖业务逻辑）

## Decisions

### D1：Docker Compose 补 frontend 服务
- **选择**：新增 `apps/web/Dockerfile`（多阶段：node build → nginx serve dist），compose 加 `frontend` 服务挂载 web dist 到 nginx 容器
- **理由**：现有 compose 的 nginx 直接用 `./apps/web/dist` 挂载（构建期产物）。补 frontend 服务使 `docker compose up` 自动构建前端，不依赖宿主预构建
- **nginx.conf**：保留现有（/api 代理 server:3001 + SPA fallback），frontend 容器用同一配置
- **备选**：继续宿主预构建 dist + nginx 挂载 → 违背「一键启动」，否决

### D2：覆盖率提升策略（聚焦低覆盖文件）
- **选择**：补齐 `analytics.controller.spec.ts` 和 `order.controller.spec.ts`，覆盖全部端点（findAll/findOne/create/update/delete/items CRUD/workbench）
- **理由**：这两个 controller 是主要缺口（40%/48%），补齐后整体覆盖率将显著提升。其余文件已 ≥90%
- **健康检查**：补 `app.controller.spec.ts` 的 DB/Redis 异常分支（503）
- **达标验证**：`pnpm --filter server test -- --coverage` 显示 All files ≥60%

### D3：E2E 冒烟脚本
- **选择**：新增 `apps/web/e2e/scripts/smoke.spec.mjs`，覆盖：登录 → 创建分类 → 创建订单 → 添加明细 → 访问工作台 → 图表渲染。数据用专属前缀 + 结束清理（沿用 P4 E2E 基建）
- **命令**：`pnpm --filter web smoke:e2e`
- **复用**：Playwright headless Chromium、authFetch、数据隔离模式

### D4：文档结构
- 根目录 `README.md`：项目简介、技术栈、架构图、快速开始（docker compose / pnpm dev）、命令表、目录结构
- `doc/部署文档.md`：docker compose 部署、环境变量、健康检查、常见问题
- `doc/API 文档.md`：Swagger 说明 + 各模块端点表 + 统一响应格式
- **理由**：README 面向使用者，部署/API 面向运维与对接

## Risks / Trade-offs

- **[Docker 构建时间]** web Dockerfile 需 pnpm install + vite build，首次构建慢 → 多阶段构建 + 利用缓存，可接受
- **[覆盖率提升幅度]** 只补 2 个 controller 可能不足以从 24% 到 60%（当前 All files 24.55% 包含所有文件，需实测）→ 若不足，再补 redis/prisma 等边缘文件或集成测试
- **[E2E 稳定性]** 冒烟依赖 dev/测试环境数据 → 用专属数据 + 清理，避免污染

## Migration Plan

无数据迁移。部署：`docker compose up -d` → 访问 http://localhost。回滚：`docker compose down`。

## Open Questions

1. 覆盖率目标 60% 是否含 controller 层（含 controller 从 24% 提升更难）→ design 按「含 controller」推进，若实测不达标可聚焦 service
