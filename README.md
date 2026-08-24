# ledger-v3

台帐系统 V3 全栈重构——面向个人/小规模用户的订单对账管理工具。

## 项目简介

核心链路为「进货地 → 订单 → 明细」，涵盖认证、基础资料（分类/单位/商品/进货地）、订单录入（含即输即建）、数据分析工作台，支持 Excel 导出。

- **规模假设**：2–3 用户，日均订单 ≤10 条，历史数据千级
- **设计原则**：保持简单、可读，不引入不必要的分布式或高并发设计

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | NestJS 10 + Prisma 6 + PostgreSQL 16 + Redis 7 |
| 前端 | Vite 6 + React 19 + TypeScript + Tailwind CSS + shadcn/ui 风格 + ECharts |
| 校验 | Zod（前后端共享 Schema） |
| 鉴权 | JWT Access + Refresh Token（Redis 黑名单） |
| 测试 | Jest（后端）+ Playwright（前端 E2E） |
| 部署 | Docker Compose + Nginx |

## 快速开始

### Docker Compose 一键启动（推荐）

```bash
docker compose up -d
```

启动 4 个容器：`frontend`（Nginx 托管前端 + /api 代理）、`postgres`、`redis`、`server`。

- 前端：http://localhost
- 后端 API：http://localhost/api
- Swagger 文档：http://localhost/api/docs

> 注：首次启动需先执行 `pnpm --filter server build` 生成后端 dist（server Dockerfile 依赖 dist），并配置 `JWT_SECRET`/`JWT_REFRESH_SECRET` 环境变量。

### 本地开发

```bash
pnpm install
pnpm dev              # 前后端同时启动（前端 5173，后端 3001）
```

默认登录：`admin / admin123`（可通过 `pnpm --filter server db:create-user` 创建用户）。

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动前后端开发环境 |
| `pnpm build` | 全量构建（shared → server → web） |
| `pnpm lint` | 全仓库 lint |
| `pnpm test` | 全仓库测试 |
| `pnpm --filter server test -- --coverage` | 后端测试 + 覆盖率 |
| `pnpm --filter web smoke:e2e` | 前端 E2E 冒烟（核心链路） |
| `pnpm --filter web verify:e2e` | 订单详情 E2E 验证 |
| `docker compose up -d` | 一键启动全部服务 |

## 目录结构

```text
ledger-v3/
├── apps/
│   ├── server/           # NestJS 后端（3001）
│   │   ├── prisma/       # Schema + 迁移 + seed
│   │   └── src/modules/  # auth/category/unit/commodity/purchase-place/order/analytics
│   └── web/              # React SPA（5173）
│       ├── src/pages/    # 业务页面（懒加载）
│       ├── src/components/ # UI 组件 + 布局
│       └── e2e/          # Playwright E2E 脚本 + 用例文档
├── packages/
│   └── shared/           # 共享 Zod Schema + 类型 + 常量
├── openspec/
│   ├── specs/            # 行为规格（SDD 权威来源）
│   └── changes/          # change artifacts（含 archive）
├── doc/                  # PRD + 部署 + API 文档
└── docker-compose.yml    # 一键部署
```

## 文档

- 产品需求：[PRD](./doc/PRD.md)
- 部署说明：[部署文档](./doc/部署文档.md)
- API 文档：[API 文档](./doc/API 文档.md)
- 行为规格：`openspec/specs/`（SDD）
- 开发执行计划：`doc/AI 重构开发执行计划.md`

## 测试

- **后端**：Jest 单元测试（Service/Controller），覆盖率 ≥60%（当前 ~98%）
- **前端**：Playwright E2E（冒烟核心链路 + 订单详情专项）
- **SDD**：所有功能先写 OpenSpec change 文档，批准后 TDD 实现
