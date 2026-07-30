# AI 重构开发执行计划（Codex + OpenSpec + SDD）

> 版本：v1.1 | 日期：2026-07-30 | 状态：已审核
> 说明：本文档是 V3 项目开发的唯一执行计划，后续所有开发工作以此为准。

---

## 一、项目目标

以 **OpenSpec** 为唯一规范来源，**Codex** 为主要开发 Agent，采用 SDD 模式完成台帐系统 V3 的全栈重构。

**输入：** PRD v5.2 + UI 设计稿（Pencil）+ V1/V2 源码（参考）+ OpenSpec（7 个 Spec 模块）

**输出：** V3 项目（NestJS + Vite React SPA）+ 完整测试 + 开发文档 + 可持续维护的 Spec 体系

---

## 二、前置准备

### ✅ 已完成

| 事项 | 状态 | 说明 |
|------|:--:|------|
| `openspec init --tools codex` | ✅ | `openspec/specs/`、`openspec/changes/` 及 `.codex/skills/openspec-*` 已生成 |
| OpenSpec 7 个 Spec 模块 | ✅ | 全部通过 `openspec validate`，三方交叉 Review 已通过 |
| PRD v5.2 | ✅ | 已审核，§8 工作台章节已对齐 Spec |
| UI 设计稿 | ✅ | Pencil `.pen` + HTML 导出，标签已对齐 V1 |
| `.gitignore` | ⬜ | 需补充 `node_modules/`、`.env`、`dist/` 等 |

### 系统级技能（无需配置）

以下 Codex 技能已预装在 `~/.codex/superpowers/skills/`，开发时 Codex 自动调用：

| 技能 | 用途 |
|------|------|
| `executing-plans` | 按 tasks.md 自动执行实现 |
| `test-driven-development` | 先写测试再写实现 |
| `subagent-driven-development` | 并行化独立子任务 |
| `verification-before-completion` | 每任务完成自动验证 |
| `writing-plans` | 从 openspec tasks 生成实现计划 |
| `finishing-a-development-branch` | Phase 完成后分支合并清理 |

### ⬜ 待补充

- 补充 `.gitignore`（`node_modules/`、`.env`、`dist/`、`*.log`）
- 后续各 Phase 的 `proposal.md`、`design.md`、`tasks.md` 由 `openspec new change` + Codex 按需生成

---

## 三、开发原则

1. **Spec First** — OpenSpec 为唯一开发依据，禁止凭个人理解或历史代码猜测
2. **Plan First** — 每个 Phase 先出 proposal + design + tasks，审核通过后再实现
3. **Small Increment** — 8 个 Phase（P0-P7）串行推进，每个独立 Review 和 Merge
4. **Architecture First** — 严格遵循 PRD §4 技术架构
5. **Test First** — 后端 Service 覆盖率 ≥ 60%，核心链路 E2E 冒烟覆盖

---

## 四、Phase 实施计划

### 里程碑

| Phase | 目标 | 完成标准 | 预计 |
|:-----:|------|----------|:--:|
| P0 | 项目骨架 | `docker compose up` 全部服务启动 | 1d |
| P1 | 认证与会话 | JWT 登录/登出/Token 刷新，未登录拦截 | 1d |
| P2 | 布局壳 & 基础组件 | SideNav + TopBar + shadcn/ui 可复用 | 0.5d |
| P3 | 基础资料 CRUD | 分类/单位/商品/进货地 完整可用 | 2d |
| P4 | 订单管理 | 订单列表+详情+明细 CRUD+Excel 导出 | 2.5d |
| P5 | 数据分析工作台 | KPI + 每日趋势 + 环形图 + 排行 + 分布 | 2d |
| P6 | 数据迁移 | V1 MongoDB → V3 PostgreSQL | 0.5d |
| P7 | 测试 & 文档 & 收尾 | 测试通过 + 文档齐全 + 一键部署 | 1.5d |

### 依赖关系

```
P0 → P1 → P2 → P3 → P4 → P5
                    ↘ P6（可并行）
P7（所有模块完成后）
```

### Phase ↔ Spec 映射

| Phase | Change 名 | 依赖 Spec |
|:-----:|----------|----------|
| P0 | `init-project-scaffold` | — |
| P1 | `auth-jwt-session` | admin-authentication |
| P2 | `layout-shell` | workspace-navigation |
| P3 | `master-data-crud` | master-data |
| P4 | `order-management` | sales-orders |
| P5 | `analytics-workbench` | analytics-workbench |
| P6 | `data-migration-v1` | data-migration |
| P7 | `testing-and-docs` | automated-acceptance |

---

## 五、SDD 执行流程

每个 Phase 按以下固定流水线推进：

```
① openspec new change <change-name>
   创建 changes/<name>/ 目录骨架
      ↓
② 编写 proposal.md + design.md + tasks.md
   基于对应 Spec 模块 + PRD §4 技术方案
      ↓
③ 👤 人工审核 proposal + design + tasks
      ↓
④ Codex 自动执行
   按 tasks.md 逐任务执行（TDD → 实现 → 验证）
   独立子任务由 subagent 并行分发
      ↓
⑤ openspec validate <change-name>
   校验实现是否符合 Spec
      ↓
⑥ openspec archive <change-name>
   归档 change，delta 合并到主 Spec
      ↓
⑦ 👤 边界审核 → 进入下一个 Phase
```

步骤 ④ 中 Codex 使用的自动化能力由系统级 `superpowers:*` 技能和项目级 `openspec-*` 技能提供，开发者无需手动调用——只需在每个 Phase 开始时执行 `openspec new change`，其余由 Codex 按流程自动完成。

---

## 六、Definition of Done

每个 Phase 归档前必须满足：

- ✅ 对应 Spec 的所有 Requirement/Scenario 已实现
- ✅ TypeScript strict 无错误
- ✅ ESLint + Prettier 通过
- ✅ 后端 Service 单元测试覆盖率 ≥ 60%
- ✅ 核心链路 E2E 冒烟测试通过
- ✅ `docker compose up` 一键启动正常
- ✅ `openspec validate` 通过

---

## 七、当前进度

| 日期 | 阶段 | 内容 |
|------|------|------|
| 2026-07-30 | 准备 | OpenSpec 初始化，7 个 Spec 编写并验证通过 |
| 2026-07-30 | 审核 | Spec ↔ PRD ↔ UI 三方交叉 Review 完成并修正 |

下一步：进入 P0 `init-project-scaffold`，开始代码实现。
