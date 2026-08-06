# ledger-v3 / Claude Code 项目上下文

> 开始工作前必须完整阅读本文件。以 `openspec/specs/`、当前 change artifacts 与实际代码为准；如果文档和代码冲突，先报告差异，不得静默猜测。

## ⚠️ SDD 铁律：先写文档，再写代码

**任何新功能开发或重大变更，必须按以下顺序执行，不得跳过或颠倒：**

1. **读取** `openspec/specs/` 下的相关规格文档
2. **创建** OpenSpec change 文档（proposal.md → design.md → specs/*/spec.md → tasks.md），参照 `openspec/changes/master-data-crud/` 的标准结构
3. **提交给用户 review**，等待明确批准
4. **只有在用户批准后**，才能创建功能分支并开始 TDD 实现

**绝对禁止**在未完成步骤 2-3 的情况下开始编写任何实现代码。这不是可选的——这是 SDD 的核心流程。

## ⚠️ Bug 修复铁律：先找根因，再给方案，审批后实施

**用户反馈 Bug 或体验问题时，不得直接动手修改。必须先：**

1. **找根因**：定位代码中导致问题的根本原因，不是只看表面现象
2. **排查关联问题**：检查是否有其他由同根因引起的、或与当前问题相关的其他问题需要一起解决
3. **给出完整方案**：基于根因提出完整的解决方案，说明要改哪些文件、怎么改、为什么这样改
4. **等待审批**：提交方案给用户 review，用户明确批准后再一次性改完

**绝对禁止**看到一个问题改一个问题，导致关联问题遗漏、需要多轮来回。

## 1. 项目概述

- **ledger-v3**：台帐系统 V3 全栈重构——面向个人/小规模用户的订单对账管理工具。
- **架构**：pnpm monorepo，后端 NestJS REST API（端口 3001），前端 Vite + React SPA（端口 5173），`packages/shared` 共享 Zod Schema。
- **范式**：SDD（Spec-Driven Development），`openspec/specs/` 为权威行为规格。
- **当前阶段**：P4——订单管理。P0–P3（骨架、认证、布局、基础资料 CRUD）已落地。
- **规模**：2–3 用户，日均 <10 订单，历史数据千级。

## 2. 常用命令

```bash
pnpm install
pnpm dev                    # 同时启动前后端
pnpm build                  # 全量构建（shared → server → web）
pnpm lint                   # 全仓库 lint
pnpm test                   # 全仓库测试

# 单包操作
pnpm --filter shared build
pnpm --filter server dev     # 后端（端口 3001）
pnpm --filter server test    # 后端测试
pnpm --filter server test -- --testPathPattern="order"  # 运行单个测试文件
pnpm --filter server db:generate
pnpm --filter server db:migrate
pnpm --filter web dev        # 前端（端口 5173）
pnpm --filter web build
```

## 3. 项目结构速览

```text
ledger-v3/
├── apps/server/src/modules/
│   ├── auth/                # JWT 登录/刷新/登出，JwtAuthGuard 作为全局 APP_GUARD
│   ├── category/            # 分类 CRUD（P3 参考模板）
│   ├── unit/                # 单位 CRUD
│   ├── commodity/           # 商品 CRUD（关联 Category+Unit，P4 最佳参考）
│   └── purchase-place/      # 进货地 CRUD
├── apps/web/src/
│   ├── components/layout/   # AppShell, SideNav, TopBar
│   ├── components/ui/       # Button, Dialog, DataTable, Select 等
│   ├── lib/                 # API 客户端(authFetch), AuthContext, Toast
│   └── pages/               # 路由页面（懒加载）
├── packages/shared/src/
│   ├── validators/index.ts  # 所有 Zod Schema（前后端共用）
│   └── constants/index.ts   # ERROR_CODES, ERROR_MESSAGES
└── openspec/
    ├── specs/               # 功能规格（sales-orders 是 P4 权威来源）
    └── changes/             # 活动 + 已归档 change artifacts
```

**后端模块标准结构**（以 commodity 为参考）：
```text
apps/server/src/modules/commodity/
├── commodity.module.ts
├── commodity.controller.ts    # 路由、守卫、Swagger、ZodValidationPipe
├── commodity.service.ts       # Prisma、事务、业务规则、错误码
└── __tests__/
    └── commodity.service.spec.ts
```

## 4. 编码铁律

### 4.1 输入校验
- 所有外部输入（body/query/param）必须通过 `packages/shared/src/validators/index.ts` 的 Zod Schema 做运行时校验。
- 后端用 `ZodValidationPipe`，前端复用同一 Schema。禁止只写 TS 类型不做校验。

### 4.2 认证
- `JwtAuthGuard` 全局注册，新接口默认受保护。公开接口用 `@Public()`。
- 返回用户用 Prisma `select` 白名单，禁止泄露 passwordHash、Token、Secret。

### 4.3 数据库
- 优先 Prisma ORM，原子操作用 `$transaction`。禁止 `$queryRawUnsafe` 和字符串拼接 SQL。
- 所有查询处理 `deletedAt: null`。金额用 Prisma Decimal。

### 4.4 日志
- 后端用 NestJS `Logger`，禁止 `console.log/error/warn`。

### 4.5 TypeScript
- `strict: true`，禁止显式 `any`。

### 4.6 测试
- Jest `*.spec.ts`，TDD 先行。覆盖：成功路径、校验失败、未认证、冲突/不存在、软删除、事务回滚。

### 4.7 响应约定
- 成功：`{ success: true, data }`。分页：`data: { items, meta: { page, pageSize, total } }`。
- 失败：`{ success: false, error: { code, message } }`，复用 `@ledger-v3/shared/constants`。
- 删除统一软删除（`deletedAt`），删除前检查关联记录。

### 4.8 Git
- **禁止直接 push main**。从 `origin/main` 创建 `feature/<功能名>` 分支。
- 所有变更通过 PR 合入 main。提交用 Conventional Commits。

## 5. Codex Agent 审查闭环

| Agent | 频率 | 行为 |
|-------|------|------|
| Bug Intake | 即时 | 澄清→复现→查重→创建 Issue + `agent-ready` 标签 |
| 自动修复 | 每小时 | 拉取 `agent-ready` Issue → TDD 修复 → Draft PR |
| 巡检 | 每天 | 扫描 main：覆盖率/安全漏洞/校验缺失 → 创建 Issue |

巡检 Agent 只创建 Issue 不修改代码。Claude Code 的职责：新功能开发（P4+），遵循 SDD/TDD。

## 6. P4 订单管理

- **权威规格**：`openspec/specs/sales-orders/spec.md`
- **最佳参考模块**：`apps/server/src/modules/commodity`
- **当前状态**：Order + OrderItem 模型已在 Prisma Schema 中定义，共享 Zod Schema（orderSchema, orderItemSchema）已存在。后端 `order/` 模块和前端订单页面尚未创建。
- **⚠️ 开始实现前必须先创建 OpenSpec change 文档并获得用户 review 批准。**
