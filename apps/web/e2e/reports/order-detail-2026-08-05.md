# 测试报告：订单明细管理 E2E 验证

> 日期：2026-08-05
> 测试范围：`apps/web/e2e/cases/order-detail.md` 13 个模块 65 条用例
> 结果：**65/65 用例通过，71/71 断言通过**（65 用例 + 6 个补充断言）

## 一、执行摘要

| 指标 | 值 |
|------|-----|
| 测试用例 | 65 条（A-M 13 模块） |
| 断言 | 71 个（含 6 个补充断言：F4b、J3b、L2b、A4b、前置×2） |
| 通过 | 71/71 ✅ |
| JS 错误 | 0 |
| React key 警告 | 0 |
| API 认证 | 全部业务请求携带 JWT |

## 二、测试脚本

- 脚本：`apps/web/e2e/scripts/order-detail.spec.mjs`
- 运行：`pnpm --filter web verify:e2e`
- 设计：创建专属测试订单 `E2E测试订单-{UNIQ}` → 全部测试在其上执行 → finally 清理（删明细/订单/商品/分类/单位），**不污染真实数据**
- 浏览器：Playwright headless Chromium，1280×900，监听 pageerror / React key 警告 / API 认证

## 三、发现的问题

### ✅ 已修复（阻塞问题，直接修复）

**BUG-1：即输即建商品缺少分类/单位时后端 500**

| 项 | 内容 |
|----|------|
| 严重性 | 🔴 阻塞（用户可直接触发） |
| 现象 | 添加明细时即输即建商品，若不选择分类或单位，保存后返回 500 Internal Server Error |
| 复现场景 | ① 仅商品名 → 500；② 商品+分类名（无单位）→ 500；③ 商品+单位名（无分类）→ 500；④ 完整路径 → ✅ 成功 |
| 根因 | `order.service.ts` Path B 即输即建：当 `categoryId`/`unitId` 缺失时直接 `commodity.create({ data: { categoryId: undefined, unitId: undefined } })`。Prisma Schema `Commodity.categoryId`/`unitId` 为必填 `String`，缺失触发 `PrismaClientValidationError: Argument category is missing` → 500 |
| 业务依据 | 商品基础资料页（`Commodities.tsx:78-79`）强制「请选择分类」「请选择单位」，即商品必须关联分类和单位。即输即建也应遵循此规则 |
| 修复 | 后端 `order.service.ts` Path B 开头增加校验：即输即建商品时必须同时提供分类和单位（id 或 name），缺失返回 `400 VALIDATION_ERROR`（"即输即建商品时必须选择分类/单位"）。前端 `OrderDetail.tsx` handleSaveItem 同步增加该校验（友好提示，不发无效请求） |
| 测试 | 新增 3 个 TDD 测试：缺分类+单位 / 有分类缺单位 / 有单位缺分类，均断言 `BadRequestException`。`order.service.spec.ts` 27/27 通过 |

### 📝 记录（非阻塞，待确认）

**REPORT-1：`app.controller.spec.ts` 2 个 health check 测试失败（预先存在，与本改动无关）**

| 项 | 内容 |
|----|------|
| 严重性 | 🟡 低（测试环境问题） |
| 现象 | `reports both dependencies as connected` 和 `keeps Redis connected when only db fails` 两个测试失败，期望 `redis: connected` 但收到 `redis: disconnected` |
| 根因 | 测试运行环境 Redis 不可用，mock 未覆盖。通过 `git stash` 验证：**在本次改动之前该失败已存在** |
| 关联 | **GitHub Issue #109**（[health 单测仍 mock 已移除的 Redis ping](https://github.com/fanqw/ledger-v3/issues/109)）已存在并跟踪此问题，本报告不再重复跟踪 |

## 四、用例覆盖明细

| 模块 | 用例数 | 结果 |
|------|--------|------|
| A 订单详情页加载 | 8 | ✅ 全部通过（含分类分组、rowSpan 合并、小计/总计） |
| B 选择已有商品 | 7 | ✅ 全部通过 |
| C 即输即建 | 8 | ✅ 全部通过 |
| D 新建项持久化 | 5 | ✅ 全部通过 |
| E 搜索时选中值保持 | 3 | ✅ 全部通过 |
| F 编辑明细 | 6 | ✅ 全部通过（含标红、反向单价、分类/单位回显） |
| G lineTotal 双向联动 | 4 | ✅ 全部通过 |
| H 删除明细 | 3 | ✅ 全部通过 |
| I Excel 导出 | 6 | ✅ 全部通过（解析 xlsx 验证合并单元格、总计行） |
| J 编辑订单 | 4 | ✅ 全部通过（含进货地 Select 选择） |
| K 返回列表 | 2 | ✅ 全部通过 |
| L 边界情况 | 6 | ✅ 全部通过 |
| M 回归检查 | 3 | ✅ 全部通过 |

## 五、数据隔离与清理

- 测试在**专属订单**上执行，结束后自动清理
- 测试前手动清理了历史测试残留数据（此前多次失败运行累积的测试明细/商品/分类/单位）
- 最终校验：订单 6（无残留）、商品 8（无残留）、分类 7（无残留）、单位 6（无残留）
- 原始订单 `20260803-06` 已恢复 3 条原始明细（2345 / 冰糖心苹果3721 / 自动创建商品）

## 六、验证充分性

- ✅ **单元测试**：`order.service.spec.ts` 27/27（含 3 个新增校验测试）
- ✅ **全量测试**：server 102/104（2 个失败为预先存在的 Redis 环境问题）
- ✅ **Lint**：无错误（3 个预先存在的 `set-state-in-effect` 警告）
- ✅ **构建**：`pnpm build` 全量编译通过
- ✅ **浏览器 E2E**：71/71 断言通过，全程无 JS 错误
- ✅ **Bug 复现验证**：修复前 3/4 场景 500，修复后 4/4 场景符合预期
