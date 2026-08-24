## 1. 前置准备

- [ ] 1.1 从 `origin/main` 创建分支 `feature/p7-automated-acceptance`
- [ ] 1.2 检查现有 docker-compose.yml / nginx.conf / server Dockerfile（复用）

## 2. Docker Compose 一键启动

- [ ] 2.1 新增 `apps/web/Dockerfile`（多阶段：node build → nginx serve dist）
- [ ] 2.2 `docker-compose.yml` 补 `frontend` 服务（构建 web + nginx 容器）
- [ ] 2.3 验证 `docker compose up -d` 启动 5 服务
- [ ] 2.4 验证 http://localhost 返回登录页 + /api/health 健康

## 3. 测试覆盖率 ≥60%

- [ ] 3.1 编写 `analytics.controller.spec.ts`（覆盖 findAll/findOne/workbench）
- [ ] 3.2 编写 `order.controller.spec.ts`（覆盖订单 CRUD + 明细 CRUD + next-name）
- [ ] 3.3 补 `app.controller.spec.ts` DB/Redis 异常分支（503）
- [ ] 3.4 运行 `pnpm --filter server test -- --coverage`，确认 All files ≥60%
- [ ] 3.5 若不达标，补充其他低覆盖文件

## 4. E2E 冒烟测试

- [ ] 4.1 新增 `apps/web/e2e/scripts/smoke.spec.mjs`（登录→创建分类→创建订单→加明细→工作台）
- [ ] 4.2 `apps/web/package.json` 加 `smoke:e2e` 脚本
- [ ] 4.3 数据隔离（专属前缀 + 清理）
- [ ] 4.4 运行冒烟脚本验证全部通过

## 5. 文档

- [ ] 5.1 根目录 `README.md`（简介/技术栈/快速开始/命令/目录结构）
- [ ] 5.2 `doc/部署文档.md`（docker compose 部署/环境变量/健康检查）
- [ ] 5.3 `doc/API 文档.md`（Swagger + 端点表 + 响应格式）

## 6. 验证与收尾

- [ ] 6.1 全量测试 + lint + build 通过
- [ ] 6.2 docker compose 一键启动验证
- [ ] 6.3 提交 + PR → review → 合入 main
- [ ] 6.4 用 `openspec-sync-specs` 同步主规格并归档 change
