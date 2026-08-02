# ledger-v3 / Claude Code 项目上下文

> 本文件供通过 CC Switch + DeepSeek V4 运行的 Claude Code 接手新功能开发时使用。开始工作前必须完整阅读本文件，并以 `openspec/specs/`、当前 change artifacts 与实际代码为准；如果文档和代码冲突，先报告差异，不得静默猜测。

## 1. 项目概述

- **项目名称**：ledger-v3（台帐系统 V3 全栈重构）。
- **项目类型**：面向个人及小规模用户的订单/对账管理工具，核心链路为“进货地 → 订单 → 明细”，涵盖认证、基础资料、订单录入、统计分析与数据迁移。
- **架构**：前后端分离的 pnpm monorepo；后端提供 REST API，前端为 Vite SPA。
- **技术栈**：NestJS + Prisma + PostgreSQL + React + TypeScript + pnpm monorepo；同时使用 Redis、JWT、Vite、Tailwind CSS、Radix/shadcn 风格组件、Zod 与 Swagger。
- **规模假设**：当前约 2–3 位用户，日均订单不超过 10 条，历史数据量为千级；保持简单、可读，不引入不必要的分布式或高并发设计。
- **规范范式**：SDD（Spec-Driven Development）。OpenSpec 是功能行为的主要规范来源，PRD 是产品与架构背景来源；每个 Phase 应按 proposal/design/spec/tasks → 实现 → 验证 → 归档推进。
- **当前阶段**：P4 开始——**订单管理**。`doc/AI 重构开发执行计划.md` 将 P0–P3 定义为项目骨架、认证与会话、布局壳与基础组件、基础资料 CRUD；这些能力已在代码中落地。P4 对应 `openspec/specs/sales-orders/spec.md`，目标是订单列表/详情、订单与明细 CRUD、即输即建、`lineTotal` 联动和 Excel 导出。
- **README 状态**：仓库根目录当前没有 `README.md`；项目简介来自 `doc/PRD.md`、执行计划、OpenSpec 和现有代码。

## 2. 已完成功能清单（P0–P3）

### P0：项目骨架

- 根目录 `package.json`、`pnpm-workspace.yaml`：组织 `apps/*` 与 `packages/*`，统一提供 `dev`、`build`、`lint`、`test`、Prisma generate/migrate 脚本。
- `apps/server`：NestJS 后端，`apps/server/src/main.ts` 设置 `/api` 全局前缀、CORS、Cookie Parser 和 Swagger（`/api/docs`）。源码实际监听 **3001** 端口。
- `apps/web`：React 19 + Vite SPA，开发端口 5173。
- `packages/shared`：前后端共享验证 Schema、类型、常量与 API 契约。
- `apps/server/src/common`：Prisma、Redis、CORS 与 Zod 验证管道等基础设施。
- Prisma/PostgreSQL 模型与迁移、Redis 会话支持、Dockerfile 和环境变量样例已存在。

### P1：认证与会话

- 路径：`apps/server/src/modules/auth`、`apps/web/src/lib/auth.tsx`、`apps/web/src/pages/Login.tsx`。
- 后端支持用户名/密码登录、JWT Access Token、Refresh Token Cookie、刷新令牌轮换、登出撤销、Redis 黑名单与会话查询。
- `JwtAuthGuard` 作为 `APP_GUARD` 全局注册；公开接口必须显式使用 `@Public()`。
- Access Token 默认 15 分钟，Refresh Token 默认 7 天；密码使用 `bcryptjs` 校验。
- `session` 查询只选择 `id`、`username`、`role`，不返回 `passwordHash`。

### P2：布局壳与基础组件

- 路径：`apps/web/src/components/layout`、`apps/web/src/components/ui`、`apps/web/src/App.tsx`。
- 已实现 `AppShell`、`SideNav`、`TopBar`、登录保护路由、主题与 Toast 支撑。
- 已提供 Button、Dialog、AlertDialog、Table/DataTable、Select、Popover、Command、Tooltip、可创建下拉框等复用组件。
- 路由已覆盖登录及四类基础资料页面；业务页面采用懒加载并有 `ChunkErrorBoundary`。

### P3：基础资料 CRUD

- `apps/server/src/modules/category`：分类分页、关键字搜索、详情、创建、更新、软删除；名称冲突与被商品引用时拒绝删除。
- `apps/server/src/modules/unit`：单位分页、搜索、CRUD、软删除；名称冲突与被商品引用保护。
- `apps/server/src/modules/commodity`：商品分页、跨商品/分类/单位/描述搜索、分类与单位关联校验、CRUD、软删除；`name + unitId` 冲突与订单明细引用保护。
- `apps/server/src/modules/purchase-place`：进货地分页、搜索、CRUD、软删除；`place + marketName` 冲突与订单引用保护。
- 对应前端页面：`apps/web/src/pages/Categories.tsx`、`Units.tsx`、`Commodities.tsx`、`PurchasePlaces.tsx`。
- 四个后端 controller 均使用 `JwtAuthGuard`、Swagger 装饰器、共享 Zod Schema 和统一 `{ success, data/error }` 响应结构。
- 注意：`openspec/changes/master-data-crud/` 当前仍位于活动 change 目录而非 archive；代码已存在，但继续 P4 前若流程要求严格归档，应先向用户报告此状态，不要自行归档。

### 数据模型现状与 P4 边界

`apps/server/prisma/schema.prisma` 当前有 7 个模型：

- `User`：用户名唯一，保存 `passwordHash`、角色及软删除时间；当前不与业务模型建立外键关系。
- `Category` 1:N `Commodity`：分类包含多个商品，`name` 有普通索引。
- `Unit` 1:N `Commodity`：单位包含多个商品，`name` 有普通索引。
- `Commodity` N:1 `Category`、N:1 `Unit`、1:N `OrderItem`；索引包括 `[name, unitId]`、`categoryId`、`unitId`。
- `PurchasePlace` 1:N `Order`：订单可选关联进货地，删除关系使用 `onDelete: Restrict`；组合索引 `[place, marketName]`。
- `Order` N:1 可选 `PurchasePlace`、1:N `OrderItem`；有 `purchasePlaceId` 与 `name` 索引。
- `OrderItem` N:1 `Order`、N:1 `Commodity`；数量为 `Decimal(12,3)`，单价和行金额为 `Decimal(12,2)`，并为两个外键建立索引。

所有模型都有 `createdAt`、`updatedAt`、`deletedAt`，业务查询必须默认排除 `deletedAt != null` 的记录。`Order` 与 `OrderItem` 已进入 Schema 和共享 Zod 验证器，但当前没有 `apps/server/src/modules/order`，也没有订单前端页面；这是 P4 的主要待开发边界。

## 3. 项目结构速览

```text
ledger-v3/
├── apps/
│   ├── server/                     # NestJS REST API
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # PostgreSQL 数据模型
│   │   │   ├── migrations/         # Prisma migrations
│   │   │   └── seed.ts             # 用户 seed/CLI
│   │   └── src/
│   │       ├── common/              # Prisma、Redis、CORS、Zod pipe
│   │       └── modules/             # auth + 四个主数据模块
│   └── web/                         # React + Vite SPA
│       └── src/
│           ├── components/layout/   # AppShell / SideNav / TopBar
│           ├── components/ui/       # 可复用 UI 原语
│           ├── lib/                 # API、认证、主题、Toast
│           └── pages/               # 路由页面
├── packages/
│   ├── shared/                      # 共享 validators、types、constants
│   └── config/                      # ESLint/Prettier 配置
├── openspec/
│   ├── specs/                       # 主规格；P4 使用 sales-orders
│   └── changes/                     # 活动与已归档 change artifacts
├── doc/PRD.md                       # PRD v5.2
└── doc/AI 重构开发执行计划.md       # P0–P7 与 SDD 流程
```

### 标准后端模块结构

现有模块使用单数目录名，典型结构如下：

```text
apps/server/src/modules/category/
├── category.module.ts
├── category.controller.ts
├── category.service.ts
└── __tests__/
    └── category.service.spec.ts
```

- controller：路由、守卫、Swagger、参数验证、响应封装。
- service：业务规则、Prisma 查询、事务与稳定错误码。
- module：注册 controller/service。
- dto：**现有模块没有 DTO 文件**；输入类型当前为 controller 内联 TypeScript 类型，运行时验证来自 `packages/shared/src/validators/index.ts` 的 Zod Schema。
- tests：Jest，命名 `*.spec.ts`；已有测试既有源码同级（如 `app.controller.spec.ts`），也有模块内 `__tests__/`（如 `category.service.spec.ts`）。新模块优先沿用模块内 `__tests__/`。

## 4. 编码铁律（与 Codex 巡检对齐）

### 4.1 输入校验：共享 Zod 为当前强制路径；不得伪造 class-validator DTO

- **实际核查结论**：`class-validator` 和 `class-transformer` 已安装，但当前仓库没有 DTO 文件，也没有 `@IsString()`、`@IsNotEmpty()` 等 class-validator 装饰器的实际使用。现有强制规范是 PRD/OpenSpec 明确的“前后端共享 Zod Schema”。
- Schema 放在 `packages/shared/src/validators/index.ts`。例如 `categorySchema` 使用 `z.string().trim().min(1).max(100)` 校验名称，`paginationSchema` 对 `page`/`pageSize` 做数字转换、整数、范围与默认值约束。
- 后端示例：`apps/server/src/modules/category/category.controller.ts` 使用 `@Body(new ZodValidationPipe(categorySchema))`；路径 ID 使用 `idSchema`，查询参数使用 `paginationSchema`，更新使用 `categorySchema.partial()`。
- 登录接口当前直接调用 `loginSchema.safeParse(body)`；新增普通业务接口应优先使用统一的 `ZodValidationPipe`，避免复制手工分支。
- **铁律**：所有外部输入（body、query、param）必须做运行时校验；P4 必须扩充/复用共享 Zod Schema，不能只写 TypeScript 类型。前端也必须复用同一 Schema。
- **class-validator + DTO 规则说明**：如果后续经用户明确决定迁移到 NestJS DTO，则 DTO 必须使用 class-validator 装饰器（如 `@IsString()`、`@IsNotEmpty()`、`@IsOptional()`）并启用 ValidationPipe；在此之前，不要混用第二套验证体系，也不要声称项目已经采用 DTO 装饰器。

### 4.2 认证守卫：实际类名为 `JwtAuthGuard`

- `apps/server/src/app.module.ts` 通过 `{ provide: APP_GUARD, useClass: JwtAuthGuard }` 注册全局守卫。
- `JwtAuthGuard` 位于 `apps/server/src/modules/auth/jwt-auth.guard.ts`，继承 `AuthGuard('jwt')`。
- 现有业务 controller 还在类级显式写 `@UseGuards(JwtAuthGuard)`，例如 `CategoryController`、`CommodityController`、`PurchasePlaceController`、`UnitController`。
- **铁律**：新业务接口默认必须受 `JwtAuthGuard` 保护；只有确属公开的接口才可使用同文件导出的 `@Public()`，且必须说明安全理由。不得为解决测试或联调问题移除/绕过守卫。
- 返回用户信息时使用 Prisma `select` 白名单；禁止暴露 `passwordHash`、令牌、Secret、Cookie 或内部异常细节。

### 4.3 数据库操作：使用 Prisma ORM 与安全事务，禁止 SQL 拼接

- `CategoryService` 等服务通过 `PrismaService` 使用 `findMany`、`findFirst`、`create`、`update`、`count` 和 `$transaction`。
- 删除流程示例：`apps/server/src/modules/category/category.service.ts` 在 `$transaction(async (tx) => ...)` 内先统计未删除关联商品，再更新 `deletedAt`。
- 搜索示例：使用 Prisma `{ contains: keyword, mode: 'insensitive' }`，不得拼接 `ILIKE` SQL。
- 仓库没有 `$queryRawUnsafe`/`$executeRawUnsafe` 或字符串拼接 SQL。唯一业务源码内的 raw query 是 `apps/server/src/app.controller.ts` 的参数化 tagged template：`this.prisma.$queryRaw\`SELECT 1\``，仅用于健康检查。
- **铁律**：必须优先使用 Prisma ORM；需要原子操作时使用 `prisma.$transaction`。确实无法由 ORM 表达时，只能使用 Prisma 参数化 tagged template，并说明原因、补测试；禁止字符串拼接 SQL 和所有 `*RawUnsafe` API。
- 所有默认列表/详情/关联保护查询必须显式处理 `deletedAt: null`；涉及金额时使用 Prisma Decimal/明确舍入策略，不得依赖浮点偶然结果。

### 4.4 日志与调试：服务端使用 NestJS `Logger`，禁止业务代码新增 console

- 项目服务端日志工具是 NestJS `Logger`。实际示例：`AuthService`、`RedisService`、`JwtStrategy`、`AppController` 均声明 `private readonly logger = new Logger(ClassName.name)`，并调用 `logger.log()` / `logger.warn()`。
- `apps/server/src` 当前没有 `console.log`、`console.error` 残留；`apps/server/prisma/seed.ts` 作为 CLI 脚本仍使用 console，前端三个错误恢复分支仍有 `console.error`/`console.warn`。
- **铁律**：NestJS 业务代码禁止 `console.log/error/warn/debug`，使用 `Logger` 并避免输出敏感字段。不要以现有 seed/前端遗留为新增 console 的先例；前端生产逻辑优先通过现有 Toast/错误边界处理用户反馈。

### 4.5 TypeScript 类型：strict 开启，新增代码禁止 `any`

- `apps/server/tsconfig.json` 开启 `strict: true`、`forceConsistentCasingInFileNames: true`、装饰器元数据与 ES2022 目标。
- 当前 `apps/` 与 `packages/` 源码搜索不到显式 `any` 类型；近期提交 `fix: remove residual any types` 也表明巡检正在清理此类问题。
- 当前 flat ESLint 配置将 `@typescript-eslint/no-explicit-any` 设为 `off`，因此“禁止 any”不是 ESLint 自动硬拦截，而是项目质量铁律。
- **铁律**：新增代码不得使用显式 `any`。优先使用 `unknown`、具体 DTO/Schema 推导类型、Prisma 类型或泛型；只有外部库边界确实无法建模时才可局部使用，并必须写清原因和收窄边界。
- 服务端未使用的变量是 ESLint error（以下划线开头的参数可忽略）；前端目前为 warn。不得通过关闭规则掩盖问题。

### 4.6 测试：Jest `*.spec.ts`，新功能必须有可复现覆盖

- `apps/server/package.json` 的 Jest `testRegex` 为 `.*.spec.ts$`，测试环境为 Node；测试命令是 `pnpm --filter server test`。
- 示例：`apps/server/src/modules/category/__tests__/category.service.spec.ts` 使用 `@nestjs/testing`、mock `PrismaService`，覆盖分页、搜索、创建、重复冲突、软删除、关联保护和不存在记录。
- 其他现有位置：`apps/server/src/app.controller.spec.ts`、`app.module.spec.ts`、`common/cors.config.spec.ts`。
- **铁律**：功能/修复必须先写失败测试，再写实现（TDD）；至少覆盖成功路径、校验失败、未认证/无权限、冲突/不存在、软删除与事务回滚。P4 还必须覆盖 Decimal/舍入、手工 `lineTotal`、跨订单 item ID、即输即建事务回滚和关联保护。
- 当前 Jest 配置**没有数值 coverageThreshold**，不可虚构百分比；但巡检 Agent 会按其外部阈值创建 Coverage Issue。提交前至少运行目标测试、`pnpm --filter server test`、相关 lint/build；需要覆盖率报告时使用 `pnpm --filter server test -- --coverage`。
- 前端 `apps/web/package.json` 当前没有 test 脚本。P4 若新增关键交互，应先按 OpenSpec/项目计划补齐合适的前端测试基础设施，不能用“当前没脚本”作为不测试的理由。

### 4.7 响应、错误与软删除约定

- 成功：`{ success: true, data: T }`；分页：`data: { items, meta: { page, pageSize, total } }`；失败：`{ success: false, error: { code, message } }`。
- 稳定错误码与中文消息来自 `@ledger-v3/shared/constants`，优先复用，不得在各模块创造语义重复的字符串。
- 业务删除是软删除：写入 `deletedAt`；删除前检查未删除的关联记录。不得直接 `delete` 数据或忽略关联保护。
- controller 负责 HTTP 边界，service 负责业务规则；避免把 Prisma 业务逻辑堆进 controller。

### 4.8 格式与代码风格

- `packages/config/.prettierrc`：分号、单引号、尾逗号、`printWidth: 100`、2 空格缩进。
- 仓库根目录没有项目级 `.editorconfig`；不要参考 `node_modules` 内第三方 `.editorconfig`。
- 命名：Prisma 模型 PascalCase、字段 camelCase、API 使用复数 kebab-case；订单明细 API 应为 `/api/orders/:orderId/items`。
- 运行 `pnpm lint` 和 `pnpm build`，不要通过修改 ESLint/TypeScript 配置来规避新错误。

### 4.9 提交信息格式

- 仓库没有 commitlint 或 Husky commit message 配置，不能声称存在机器强制规则。
- 最近提交稳定采用 Conventional Commits 风格：`feat: ...`、`fix: ...`、`test: ...`、`chore: ...`，也出现 `fix(server): ...`、`fix(web): ...` 的 scope。
- **铁律**：使用 `<type>(可选 scope): <简洁说明>`；新功能优先 `feat:`，修复 `fix:`，测试 `test:`，维护 `chore:`。一个提交聚焦一个逻辑变更，不把无关格式化或生成物混入提交。

### 4.10 Git 分支与 Pull Request 铁律

- `main` 是受保护分支。**任何人类或 AI Agent（包括 Claude Code、Codex 及自动修复 Agent）都禁止直接向 `main` push，也禁止在 `main` 上提交开发变更。**
- 开始任何开发、修复或文档工作前，先获取最新的 `origin/main`，再从 `origin/main` 创建独立的非 `main` 分支。Claude Code 新功能分支使用 `feature/<功能名>`；Codex 默认使用 `codex/` 前缀；自动修复 Agent 继续使用 `feature/fix-{issue-number}`。
- 只允许 push 当前工作分支。所有进入 `main` 的变更都必须通过以 `main` 为目标分支的 Pull Request，并等待仓库要求的 Review 与 CI 检查通过后再合并。
- 禁止 force push `main`、管理员绕过、临时关闭分支保护或以任何方式规避 PR 流程。除非用户明确授权，不得自行合并 PR。
- 如果当前位于 `main`，必须先创建并切换到工作分支再产生提交；如果已有未提交改动，先保留改动并安全切换，不得丢弃用户修改。
- 交付时必须明确报告当前分支、提交状态、是否已 push、PR 地址或尚待创建 PR 的下一步。**本地提交不等于已经合入 `main`。**

### 4.11 近期开发模式

- 最近 20 条非合并提交的重点是 Refresh Token 轮换、Redis 失败传播、认证错误契约、依赖漏洞修复、Node/ESLint 工具链、移除 `any`、暴露被吞掉的异常和补充模块/健康检查测试。
- 这说明审查偏好是：安全与错误不可静默降级、类型边界清晰、依赖风险及时修复、修复必须配测试。P4 不得回退这些策略。

## 5. Codex Agent 工作流与审查机制（重要！）

**Codex 当前部署了 3 个 Agent，形成一个自动化的审查与修复闭环：**

1. **Bug Intake Agent（即时触发）**
   - 用户提交零散的 Bug 描述或截图后，该 Agent 负责澄清、复现、查重，整理成高质量的 GitHub Issue 草稿。
   - 经用户确认后，在 `fanqw/ledger-v3` 仓库正式创建 Issue，并打上 `agent-ready` 标签。

2. **自动修复 Agent（每小时运行一次）**
   - 定时拉取所有带有 `agent-ready` 标签的 Open Issue。
   - 对每个 Issue 执行：独立 clone 仓库 → 创建 `feature/fix-{issue-number}` 分支 → 编写复现测试 → 实施修复 → 通过测试 → 提交并推送 → 创建 Draft PR（标题格式 `fix: ...`，PR body 末尾包含 `Closes #N`）。
   - 优先处理同时带有 `user-reported` 和 `agent-ready` 的 Issue（用户确认的 Bug 排在队列最前）。
   - 也会检查自己之前创建的 PR 是否有 Review 反馈，并优先处理修改请求。
   - 修复过程中严格遵守 TDD，并且不会降级安全策略。

3. **巡检 Agent（每天运行一次）**
   - 每天基于最新的 `origin/main` 执行全仓库巡检，包括：
     - 测试覆盖率（低于阈值的文件创建 Coverage Issue）
     - 依赖安全审计（critical/high 漏洞自动创建 Issue 并加 `agent-ready`）
     - 代码安全审查（未校验输入、缺少守卫、敏感字段泄露、SQL 拼接等，自动创建 Issue 并加 `agent-ready`）
     - 性能热点分析（缺失索引、N+1 查询等，创建 medium Issue，不加 agent-ready，等待人工确认）
     - 代码异味扫描（any 类型、console 残留、空 catch、TODO 超期等，不单独创建 Issue，每周汇总为代码健康周报）
     - E2E 核心路径巡检（登录 → CRUD → 登出，核心路径失败自动创建 high Issue 并加 agent-ready）
   - **巡检 Agent 只创建 Issue，绝对不修改代码。** 只有打上 `agent-ready` 的 Issue 才会被自动修复 Agent 领取。

**交互闭环：**
- Bug Intake（用户触发） → 用户确认 → `agent-ready` Issue → 自动修复 Agent（每小时） → Draft PR
- 巡检 Agent（每日自动） → 直接为 critical/high 安全类问题创建 `agent-ready` Issue → 自动修复 Agent
- 巡检 Agent 发现的 medium/low 问题 → 需用户手动确认并添加 `agent-ready` → 自动修复 Agent

**对 Claude Code 的影响：**
- 你（Claude Code）提交的任何代码都会在下一次巡检中被扫描。如果存在安全漏洞、输入校验缺失、认证缺失等问题，会在几小时内被自动创建为 high/critical Issue 并进入自动修复队列，可能导致你刚写的代码被自动修复 Agent 修改。
- 请严格遵守下面“编码铁律”，这样你的代码可以通过巡检，不会被自动修复流程干扰。
- 你的角色仅限于新功能开发（P4 及以后），Bug 请通过正常的 Bug Intake 方式提交，代码审查和修复工作由 Codex 自动完成，无需你参与。

## 6. 当前任务起手式

- **P4 任务描述**：订单管理——实现 Order + OrderItem 后端模块与前端订单列表/详情页，支持分页搜索、订单及明细 CRUD、主数据即输即建、`quantity × unitPrice` 与 `lineTotal` 联动、分类小计/订单总计、Excel 导出。权威行为规格见 `openspec/specs/sales-orders/spec.md`；开始实现前应创建对应 OpenSpec change 并确认 tasks。
- **分支**：先获取最新 `origin/main`，再基于 `origin/main` 创建 `feature/p4-order-management`（通用模板：`feature/p4-{功能简称}`）；禁止直接在 `main` 上提交或 push。
- **安装依赖**：`pnpm install`。
- **启动开发**：`pnpm --filter server dev`（交接约定写作 server 在 3000），`pnpm --filter web dev`（web 在 5173）。**实际代码 `apps/server/src/main.ts` 当前调用 `app.listen(3001)`，因此联调前必须确认应使用 3001 还是调整运行配置；不要未经用户批准修改端口。**
- **运行测试**：`pnpm --filter server test`。
- **建议参考的已实现模块**：`apps/server/src/modules/commodity`。它与 P4 同样涉及关联实体、分页搜索、外键校验、冲突错误、软删除保护和 Prisma include；事务模式另参考 `apps/server/src/modules/category/category.service.ts`。
- **共享验证入口**：扩展 `packages/shared/src/validators/index.ts` 中已存在的 `orderSchema`、`orderItemSchema`，确保 Decimal/HTTP JSON 数值转换、trim、ID 格式和更新场景均有明确约束。
- **规范优先级**：当前 OpenSpec change/spec → `openspec/specs/sales-orders/spec.md` → `doc/PRD.md` → 现有实现模式。遇到矛盾先报告并请求裁决。

## 7. AI 协作边界

- 你（Claude Code）负责新功能开发（P4 及以后），遵循 SDD/TDD，并在实现前读取相应 OpenSpec。
- Bug 报告走 Codex Bug Intake Agent；不要绕过 Intake 私自承接零散 Bug 修复。
- 代码审查和修复由 Codex 自动修复 Agent 处理；不要主动修改 Codex Agent 配置、标签、自动化或其临时目录。
- 每天 Codex 会运行巡检，你的代码质量会直接影响是否需要后续修复。
- 所有 Claude Code 与 Codex 产出的变更都必须通过非 `main` 工作分支提交，并以 Pull Request 作为进入 `main` 的唯一入口；不得直接 push `main` 或绕过分支保护。
- 不得通过降低守卫、校验、错误传播、测试、ESLint、TypeScript strict 或依赖安全策略来让功能“先跑起来”。
- 提交前检查 `git diff`，只包含当前 P4 change 范围；不要提交 `.env`、凭据、构建产物、coverage 或 Agent 临时文件。

## 8. 常用命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm --filter server dev
pnpm --filter server test
pnpm --filter server test -- --coverage
pnpm --filter server db:generate
pnpm --filter server db:migrate
pnpm --filter web dev
pnpm --filter web build
```

Node 版本要求来自根 `package.json`：`^20.19.0 || ^22.13.0 || >=24.0.0`；pnpm 要求 `>=9.0.0`。
