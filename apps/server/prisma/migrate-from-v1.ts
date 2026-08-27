/**
 * V1 MongoDB → V3 PostgreSQL 数据迁移
 *
 * 流程：导出（MongoDB driver）→ 转换（ObjectId/字段名/软删除）→ 导入（映射表 + upsert）→ 验证
 * 执行：V1_MONGO_URL=... pnpm --filter server db:migrate-from-v1
 *
 * 只写 V3，不修改 V1 MongoDB。幂等：以 id 为唯一键 upsert。
 */
import { MongoClient } from 'mongodb';
import { PrismaClient, Prisma } from '@prisma/client';

// ==================== 类型 ====================

export interface V1Record {
  _id: unknown;
  [key: string]: unknown;
}

// ==================== 转换辅助 ====================

/** V1 deleted 布尔 → V3 deletedAt */
export function toDeletedAt(v1: V1Record): Date | null {
  if (v1.deleted === true) {
    return toDate(v1.update_at) || toDate(v1.updatedAt) || new Date();
  }
  return null;
}

/** 取时间字段，兼容 Date/字符串 */
export function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ObjectId / 任意 id → 24 位 hex 字符串（MongoDB ObjectId 的 String() 返回 hex） */
export function toHexId(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

/**
 * 字段名映射：V1 → V3 字段名
 * - desc → description
 * - count → quantity
 * - price → unitPrice
 * - create_at/createdAt → createdAt
 * - update_at/updatedAt → updatedAt
 */
export function mapFields(v1: V1Record): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(v1)) {
    switch (key) {
      case 'desc': out['description'] = value; break;
      case 'count': out['quantity'] = value; break;
      case 'price': out['unitPrice'] = value; break;
      case 'create_at': out['createdAt'] = value; break;
      case 'update_at': out['updatedAt'] = value; break;
      case '_id': break; // 单独处理
      default: out[key] = value;
    }
  }
  return out;
}

// ==================== 主流程 ====================

/**
 * 执行迁移（依赖注入，便于测试）。
 * @param prisma V3 PrismaClient
 * @param client V1 MongoClient（已连接）
 */
export async function runMigration(
  prisma: Pick<PrismaClient, 'user' | 'category' | 'unit' | 'commodity' | 'order' | 'orderItem' | '$disconnect'>,
  client: { db: () => { collection: (name: string) => { find: () => { toArray: () => Promise<unknown[]> } } } },
): Promise<{ stats: Record<string, number>; failures: string[]; skips: string[] }> {
  const db = client.db();

  // 导出 6 集合（只读）
  const collections = await Promise.all(
    ['users', 'category', 'unit', 'commodity', 'order', 'order_commodity'].map((name) =>
      db.collection(name).find().toArray(),
    ),
  );
  const [users, categories, units, commodities, orders, ordercommodities] = collections as V1Record[][];

  // 导出统计（防连接串缺库名时静默导入 0 条）
  const exportCounts = { users: users.length, categories: categories.length, units: units.length, commodities: commodities.length, orders: orders.length, ordercommodities: ordercommodities.length };
  console.log('导出记录数:', JSON.stringify(exportCounts));

  const stats = {
    users: 0,
    categories: 0,
    units: 0,
    commodities: 0,
    orders: 0,
    orderItems: 0,
    skipped: 0,
    failed: 0,
  };
  const skips: string[] = [];

  // 转换与导入（按依赖顺序）
  const idMap = new Map<string, string>(); // v1Id -> v3Id

    // 1. User
    for (const doc of users) {
      const v1 = doc as V1Record;
      const v1Id = toHexId(v1._id);
      try {
        const data = {
          id: v1Id,
          username: String(v1.username || v1.user_name || `user-${v1Id}`),
          passwordHash: String(v1.password || v1.passwordHash || v1.password_hash || ''),
          role: String(v1.role || 'admin'),
          deletedAt: toDeletedAt(v1),
          createdAt: toDate(v1.create_at || v1.createdAt) || new Date(),
          updatedAt: toDate(v1.update_at || v1.updatedAt) || new Date(),
        };
        await prisma.user.upsert({
          where: { id: data.id },
          create: data,
          update: { username: data.username, passwordHash: data.passwordHash, role: data.role, deletedAt: data.deletedAt, createdAt: data.createdAt, updatedAt: data.updatedAt },
        });
        idMap.set(v1Id, v1Id);
        stats.users++;
      } catch (e) {
        stats.failed++;
        console.warn(`[Failed] user ${v1Id}: ${(e as Error).message}`);
      }
    }

    // 2. Category
    for (const doc of categories) {
      const v1 = doc as V1Record;
      const v1Id = toHexId(v1._id);
      try {
        const mapped = mapFields(v1);
        const data = {
          id: v1Id,
          name: String(v1.name || '未命名分类'),
          description: mapped.description ? String(mapped.description) : undefined,
          deletedAt: toDeletedAt(v1),
          createdAt: toDate(mapped.createdAt || v1.create_at) || new Date(),
          updatedAt: toDate(mapped.updatedAt || v1.update_at) || new Date(),
        };
        await prisma.category.upsert({
          where: { id: data.id },
          create: data,
          update: { name: data.name, description: data.description, deletedAt: data.deletedAt, createdAt: data.createdAt, updatedAt: data.updatedAt },
        });
        idMap.set(v1Id, v1Id);
        stats.categories++;
      } catch (e) {
        stats.failed++;
        console.warn(`[Failed] category ${v1Id}: ${(e as Error).message}`);
      }
    }

    // 3. Unit
    for (const doc of units) {
      const v1 = doc as V1Record;
      const v1Id = toHexId(v1._id);
      try {
        const mapped = mapFields(v1);
        const data = {
          id: v1Id,
          name: String(v1.name || '未命名单位'),
          description: mapped.description ? String(mapped.description) : undefined,
          deletedAt: toDeletedAt(v1),
          createdAt: toDate(mapped.createdAt || v1.create_at) || new Date(),
          updatedAt: toDate(mapped.updatedAt || v1.update_at) || new Date(),
        };
        await prisma.unit.upsert({
          where: { id: data.id },
          create: data,
          update: { name: data.name, description: data.description, deletedAt: data.deletedAt, createdAt: data.createdAt, updatedAt: data.updatedAt },
        });
        idMap.set(v1Id, v1Id);
        stats.units++;
      } catch (e) {
        stats.failed++;
        console.warn(`[Failed] unit ${v1Id}: ${(e as Error).message}`);
      }
    }

    // 4. Commodity
    for (const doc of commodities) {
      const v1 = doc as V1Record;
      const v1Id = toHexId(v1._id);
      const categoryId = idMap.get(String(v1.category_id || v1.categoryId));
      const unitId = idMap.get(String(v1.unit_id || v1.unitId));
      if (!categoryId || !unitId) {
        stats.skipped++;
        skips.push(`commodity ${v1Id}: 分类/单位外键缺失（category_id=${v1.category_id}, unit_id=${v1.unit_id}）`);
        continue;
      }
      try {
        const mapped = mapFields(v1);
        const data: Prisma.CommodityUncheckedCreateInput = {
          id: v1Id,
          name: String(v1.name || '未命名商品'),
          categoryId,
          unitId,
          description: mapped.description ? String(mapped.description) : undefined,
          deletedAt: toDeletedAt(v1),
          createdAt: toDate(mapped.createdAt || v1.create_at) || new Date(),
          updatedAt: toDate(mapped.updatedAt || v1.update_at) || new Date(),
        };
        await prisma.commodity.upsert({
          where: { id: data.id },
          create: data,
          update: {
            name: data.name, categoryId: data.categoryId, unitId: data.unitId,
            description: data.description, deletedAt: data.deletedAt, createdAt: data.createdAt, updatedAt: data.updatedAt,
          },
        });
        idMap.set(v1Id, v1Id);
        stats.commodities++;
      } catch (e) {
        stats.failed++;
        console.warn(`[Failed] commodity ${v1Id}: ${(e as Error).message}`);
      }
    }

    // 5. Order
    for (const doc of orders) {
      const v1 = doc as V1Record;
      const v1Id = toHexId(v1._id);
      try {
        const mapped = mapFields(v1);
        const data = {
          id: v1Id,
          name: String(v1.name || `订单-${v1Id.slice(0, 8)}`),
          description: mapped.description ? String(mapped.description) : undefined,
          // V1 订单进货地不在迁移范围（PurchasePlace 未迁移），置空
          deletedAt: toDeletedAt(v1),
          createdAt: toDate(mapped.createdAt || v1.create_at) || new Date(),
          updatedAt: toDate(mapped.updatedAt || v1.update_at) || new Date(),
        };
        await prisma.order.upsert({
          where: { id: data.id },
          create: data,
          update: { name: data.name, description: data.description, deletedAt: data.deletedAt, createdAt: data.createdAt, updatedAt: data.updatedAt },
        });
        idMap.set(v1Id, v1Id);
        stats.orders++;
      } catch (e) {
        stats.failed++;
        console.warn(`[Failed] order ${v1Id}: ${(e as Error).message}`);
      }
    }

    // 6. OrderItem（V1 collection: ordercommodities）
    for (const doc of ordercommodities) {
      const v1 = doc as V1Record;
      const v1Id = toHexId(v1._id);
      const orderId = idMap.get(String(v1.order_id || v1.orderId));
      const commodityId = idMap.get(String(v1.commodity_id || v1.commodityId));
      if (!orderId || !commodityId) {
        stats.skipped++;
        skips.push(`order_commodity ${v1Id}: 外键缺失（order_id=${v1.order_id}, commodity_id=${v1.commodity_id}）`);
        continue;
      }
      try {
        const mapped = mapFields(v1);
        // V1 无 lineTotal 字段，用 count × price 整数四舍五入（对齐 V1 后端 $round：total_price）
        const quantity = Number(v1.count ?? 0);
        const unitPrice = Number(v1.price ?? 0);
        const lineTotal = v1.lineTotal !== undefined
          ? Number(v1.lineTotal)
          : Math.round(quantity * unitPrice);
        const data: Prisma.OrderItemCreateInput = {
          id: v1Id,
          order: { connect: { id: orderId } },
          commodity: { connect: { id: commodityId } },
          // Decimal 直接传值，避免 Number() 中转精度损失
          quantity: new Prisma.Decimal(String(quantity)),
          unitPrice: new Prisma.Decimal(String(unitPrice)),
          lineTotal: new Prisma.Decimal(String(lineTotal)),
          description: mapped.description ? String(mapped.description) : undefined,
          deletedAt: toDeletedAt(v1),
          createdAt: toDate(mapped.createdAt || v1.create_at) || new Date(),
          updatedAt: toDate(mapped.updatedAt || v1.update_at) || new Date(),
        };
        // OrderItem 以 id 为唯一键幂等
        await prisma.orderItem.upsert({
          where: { id: v1Id },
          create: data,
          update: {
            order: { connect: { id: orderId } },
            commodity: { connect: { id: commodityId } },
            quantity: data.quantity, unitPrice: data.unitPrice, lineTotal: data.lineTotal,
            description: data.description, deletedAt: data.deletedAt, createdAt: data.createdAt, updatedAt: data.updatedAt,
          },
        });
        stats.orderItems++;
      } catch (e) {
        stats.failed++;
        console.warn(`[Failed] orderItem ${v1Id}: ${(e as Error).message}`);
      }
    }

    // ==================== 验证（失败阻断）====================
    console.log('\n=== 迁移验证 ===');
    const failures = await verify(prisma, { users, categories, units, commodities, orders, ordercommodities });
    for (const f of failures) console.log(`  ❌ ${f}`);

    // 摘要
    console.log('\n=== 迁移摘要 ===');
    console.log(JSON.stringify(stats, null, 2));
    if (skips.length > 0) {
      console.log(`\n跳过记录（${skips.length} 条）：`);
      for (const s of skips) console.log(`  - ${s}`);
    }
    if (failures.length === 0) console.log('迁移完成 ✅');

    return { stats, failures, skips };
}

/**
 * 命令行入口：读取环境变量、建立连接、执行迁移、处理退出码。
 */
async function main() {
  // 显式加载 .env（ts-node 直跑时确保读到 V1_MONGO_URL）
  try { require('dotenv').config(); } catch { /* dotenv 不可用时忽略 */ }

  let mongoUrl = process.env.V1_MONGO_URL;
  if (!mongoUrl) {
    console.error('缺少 V1_MONGO_URL 环境变量（V1 MongoDB 连接串）');
    process.exit(1);
  }
  // V1 认证库可能未在 URL 指定（authSource），默认走 admin，避免 Authentication failed
  if (!mongoUrl.includes('authSource') && !mongoUrl.includes('authMechanism')) {
    mongoUrl += (mongoUrl.includes('?') ? '&' : '?') + 'authSource=admin';
  }

  const prisma = new PrismaClient();
  const client = new MongoClient(mongoUrl);
  try {
    await client.connect();
    const { failures } = await runMigration(prisma, client);
    if (failures.length > 0) {
      console.error(`\n迁移验证失败（${failures.length} 项），未完成。`);
      process.exit(1);
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

// ==================== 验证 ====================

interface VerifyInput {
  users: V1Record[];
  categories: V1Record[];
  units: V1Record[];
  commodities: V1Record[];
  orders: V1Record[];
  ordercommodities: V1Record[];
}

/** 返回失败清单；空数组表示全部通过 */
async function verify(
  prisma: Pick<PrismaClient, 'user' | 'category' | 'unit' | 'commodity' | 'order' | 'orderItem' | '$disconnect'>,
  v1: VerifyInput,
): Promise<string[]> {
  const failures: string[] = [];

  // 1. 记录数验证
  const counts = {
    users: await prisma.user.count({ where: { deletedAt: null } }),
    categories: await prisma.category.count({ where: { deletedAt: null } }),
    units: await prisma.unit.count({ where: { deletedAt: null } }),
    commodities: await prisma.commodity.count({ where: { deletedAt: null } }),
    orders: await prisma.order.count({ where: { deletedAt: null } }),
    orderItems: await prisma.orderItem.count({ where: { deletedAt: null } }),
  };
  const v1Counts = {
    users: v1.users.filter((u) => !(u as V1Record).deleted).length,
    categories: v1.categories.filter((c) => !(c as V1Record).deleted).length,
    units: v1.units.filter((u) => !(u as V1Record).deleted).length,
    commodities: v1.commodities.filter((c) => !(c as V1Record).deleted).length,
    orders: v1.orders.filter((o) => !(o as V1Record).deleted).length,
    orderItems: v1.ordercommodities.filter((o) => !(o as V1Record).deleted).length,
  };
  for (const k of Object.keys(counts) as (keyof typeof counts)[]) {
    if (counts[k] !== v1Counts[k]) {
      failures.push(`记录数 ${k}: V3=${counts[k]}, V1=${v1Counts[k]}`);
    }
  }
  console.log(`记录数: ${failures.length === 0 ? '✅' : '❌'}`);

  // 2. 金额汇总（V3 只计未删除，与 V1 口径一致；V1 无 lineTotal，用 count × price）
  const v3Sum = await prisma.orderItem.aggregate({
    _sum: { lineTotal: true },
    where: { deletedAt: null },
  });
  const v1Sum = v1.ordercommodities
    .filter((o) => !(o as V1Record).deleted)
    .reduce((s, o) => {
      const q = Number((o as V1Record).count || 0);
      const p = Number((o as V1Record).price || 0);
      const lt = (o as V1Record).lineTotal !== undefined
        ? Number((o as V1Record).lineTotal)
        : Math.round(q * p);
      return s + lt;
    }, 0);
  const v3Num = Number(v3Sum._sum.lineTotal || 0);
  if (Math.abs(v3Num - v1Sum) > 0.01) {
    failures.push(`SUM(lineTotal): V3=${v3Num}, V1=${v1Sum}`);
  }
  console.log(`SUM(lineTotal): ${failures.length === 0 ? '✅' : '❌'} (V3=${v3Num}, V1=${v1Sum})`);

  // 3. 外键完整性
  const orderItems = await prisma.orderItem.findMany({ where: { deletedAt: null } });
  const orderIds = new Set((await prisma.order.findMany({ select: { id: true } })).map((o) => o.id));
  const commodityIds = new Set((await prisma.commodity.findMany({ select: { id: true } })).map((c) => c.id));
  const fkOrderOk = orderItems.every((i) => orderIds.has(i.orderId));
  const fkCommodityOk = orderItems.every((i) => commodityIds.has(i.commodityId));
  if (!fkOrderOk) failures.push('外键 orderId 存在缺失');
  if (!fkCommodityOk) failures.push('外键 commodityId 存在缺失');
  console.log(`外键 orderId: ${fkOrderOk ? '✅' : '❌'}`);
  console.log(`外键 commodityId: ${fkCommodityOk ? '✅' : '❌'}`);

  // 4. 密码哈希一致性（如实验证：V1 hash 与 V3 落库值比对）
  const firstUser = v1.users.find((u) => !(u as V1Record).deleted) as V1Record | undefined;
  if (firstUser) {
    const v1Hash = String(firstUser.password || firstUser.passwordHash || firstUser.password_hash || '');
    const v3User = await prisma.user.findFirst({
      where: { username: String(firstUser.username || firstUser.user_name) },
    });
    if (!v1Hash) {
      failures.push(`用户 ${firstUser.username} 密码哈希缺失`);
    } else if (!v3User) {
      failures.push(`用户 ${firstUser.username} 未在 V3 找到`);
    } else if (v3User.passwordHash !== v1Hash) {
      failures.push(`用户 ${firstUser.username} 密码哈希不一致（仅验证 hash 复制，未验证真实登录）`);
    } else {
      console.log(`密码哈希: ✅ 一致（用户 ${firstUser.username}；仅验证 hash 复制，真实登录需正确密码验证）`);
    }
  } else {
    console.log('密码验证: ⏭ 无用户');
  }

  return failures;
}

// 直接运行（pnpm db:migrate-from-v1）时执行；被测试 import 时不触发
if (require.main === module) {
  main().catch((e) => {
    console.error('迁移失败:', e);
    process.exit(1);
  });
}
