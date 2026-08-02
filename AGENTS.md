# ledger-v3 Agent 项目规范

本文件适用于在本仓库工作的所有 Codex Agent。Claude Code 同时受根目录 `CLAUDE.md` 约束。

## Git 与 Pull Request 铁律

- `main` 是受保护分支。**任何人类或 AI Agent（包括 Codex、Claude Code 及自动修复 Agent）都禁止直接向 `main` push，也禁止在 `main` 上提交开发变更。**
- 开始任何开发、修复或文档工作前，先获取最新的 `origin/main`，再从 `origin/main` 创建独立的非 `main` 分支。Codex 分支默认使用 `codex/` 前缀；已有自动修复流程可继续使用约定的 `feature/fix-{issue-number}`。
- 只允许 push 当前工作分支。所有进入 `main` 的变更都必须通过以 `main` 为目标分支的 Pull Request，并等待仓库要求的 Review 与 CI 检查通过后再合并。
- 禁止通过 force push、管理员绕过、临时关闭分支保护或使用其他方式规避 PR 流程。除非用户明确授权，不得自行合并 PR。
- 如果开始工作时位于 `main`，必须先创建并切换到工作分支再产生提交；如果已有未提交改动，先保留改动并安全切换到工作分支，不得为了切分支丢弃用户修改。
- 完成交付时必须明确报告当前分支、提交状态、是否已 push、PR 地址或尚待创建 PR 的下一步；不得声称本地提交已经进入 `main`。

## 其他规范入口

- 产品与架构背景：`doc/PRD.md`。
- SDD 阶段与流程：`doc/AI 重构开发执行计划.md`、`openspec/`。
- Claude Code 的完整项目上下文与编码铁律：`CLAUDE.md`。
