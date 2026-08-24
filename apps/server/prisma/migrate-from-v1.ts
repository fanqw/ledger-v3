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
import * as bcrypt from 'bcryptjs';

// ==================== 类型 ====================

// ==================== 主流程 ====================

async function main() {
  const mongoUrl = process.env.V1_MONGO_URL;
  if (!mongoUrl) {
    console.error('缺少 V1_MONGO_URL 环境变量（V1 MongoDB 连接串）');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const client = new MongoClient(mongoUrl);

  const stats = {
    users: 0,
    categories: 0,
    units: 0,
    commodities: 0,
    orders: 0,
    orderItems: 0,
  };

  try {
    await client.connect();
    const db = client.db();

    // 导出 6 集合（只读）
    const collections = await Promise.all(
      ['users', 'categories', 'units', 'commodities', 'orders', 'ordercommodities'].map((name) =>
        db.collection(name).find().toArray(),
      ),
    );
    const [users, categories, units, commodities, orders, ordercommodities] = collections;

    // 转换与导入（按依赖顺序）
    const idMap = new Map<string, string>(); // v1Id -> v3Id

    // 1. User
    for (const doc of users) {
      const v1 = doc as V1Record;
      const v1Id = String(v1._id);
      const data = {
        id: v1Id,
        username: String(v1.username || v1.user_name || ''),
        passwordHash: String(v1.passwordHash || v1.password_hash || ''),
        role: String(v1.role || 'admin'),
        description: v1.desc ? String(v1.desc) : undefined,
        deletedAt: toDeletedAt(v1),
        createdAt: toDate(v1.create_at) || new Date(),
        updatedAt: toDate(v1.update_at) || new Date(),
      };
      await prisma.user.upsert({
        where: { id: data.id },
        create: data,
        update: { ...data, id: undefined },
      });
      idMap.set(v1Id, v1Id);
      stats.users++;
    }

    // 2. Category
    for (const doc of categories) {
      const v1 = doc as V1Record;
      const v1Id = String(v1._id);
      const data = {
        id: v1Id,
        name: String(v1.name),
        description: v1.desc ? String(v1.desc) : undefined,
        deletedAt: toDeletedAt(v1),
        createdAt: toDate(v1.create_at) || new Date(),
        updatedAt: toDate(v1.update_at) || new Date(),
      };
      await prisma.category.upsert({
        where: { id: data.id },
        create: data,
        update: { ...data, id: undefined },
      });
      idMap.set(v1Id, v1Id);
      stats.categories++;
    }

    // 3. Unit
    for (const doc of units) {
      const v1 = doc as V1Record;
      const v1Id = String(v1._id);
      const data = {
        id: v1Id,
        name: String(v1.name),
        description: v1.desc ? String(v1.desc) : undefined,
        deletedAt: toDeletedAt(v1),
        createdAt: toDate(v1.create_at) || new Date(),
        updatedAt: toDate(v1.update_at) || new Date(),
      };
      await prisma.unit.upsert({
        where: { id: data.id },
        create: data,
        update: { ...data, id: undefined },
      });
      idMap.set(v1Id, v1Id);
      stats.units++;
    }

    // 4. Commodity
    for (const doc of commodities) {
      const v1 = doc as V1Record;
      const v1Id = String(v1._id);
      const categoryId = idMap.get(String(v1.categoryId));
      const unitId = idMap.get(String(v1.unitId));
      if (!categoryId || !unitId) {
        console.warn(`[Skip] commodity ${v1Id}: 分类/单位外键缺失（categoryId=${v1.categoryId}, unitId=${v1.unitId}）`);
        continue;
      }
      const data: Prisma.CommodityUncheckedCreateInput = {
        id: v1Id,
        name: String(v1.name),
        categoryId,
        unitId,
        description: v1.desc ? String(v1.desc) : undefined,
        deletedAt: toDeletedAt(v1),
        createdAt: toDate(v1.create_at) || new Date(),
        updatedAt: toDate(v1.update_at) || new Date(),
      };
      await prisma.commodity.upsert({
        where: { id: data.id },
        create: data,
        update: {
          name: data.name,
          categoryId: data.categoryId,
          unitId: data.unitId,
          description: data.description,
          deletedAt: data.deletedAt,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        },
      });
      idMap.set(v1Id, v1Id);
      stats.commodities++;
    }

    // 5. Order
    for (const doc of orders) {
      const v1 = doc as V1Record;
      const v1Id = String(v1._id);
      const data = {
        id: v1Id,
        name: String(v1.name),
        description: v1.desc ? String(v1.desc) : undefined,
        // V1 订单进货地不在迁移范围（PurchasePlace 未迁移），置空
        deletedAt: toDeletedAt(v1),
        createdAt: toDate(v1.create_at) || new Date(),
        updatedAt: toDate(v1.update_at) || new Date(),
      };
      await prisma.order.upsert({
        where: { id: data.id },
        create: data,
        update: { ...data, id: undefined },
      });
      idMap.set(v1Id, v1Id);
      stats.orders++;
    }

    // 6. OrderItem（V1 collection: ordercommodities）
    for (const doc of ordercommodities) {
      const v1 = doc as V1Record;
      const v1Id = String(v1._id);
      const orderId = idMap.get(String(v1.orderId));
      const commodityId = idMap.get(String(v1.commodityId));
      if (!orderId || !commodityId) {
        console.warn(`[Skip] ordercommodities ${v1Id}: 外键缺失（orderId=${v1.orderId}, commodityId=${v1.commodityId}）`);
        continue;
      }
      const data: Prisma.OrderItemCreateInput = {
        id: v1Id,
        order: { connect: { id: orderId } },
        commodity: { connect: { id: commodityId } },
        quantity: new Prisma.Decimal(Number(v1.count ?? 0)),
        unitPrice: new Prisma.Decimal(Number(v1.price ?? 0)),
        lineTotal: new Prisma.Decimal(Number(v1.lineTotal ?? 0)),
        description: v1.desc ? String(v1.desc) : undefined,
        deletedAt: toDeletedAt(v1),
        createdAt: toDate(v1.create_at) || new Date(),
        updatedAt: toDate(v1.update_at) || new Date(),
      };
      // OrderItem 无唯一业务键，用 findFirst 幂等
      const existing = await prisma.orderItem.findFirst({ where: { id: v1Id } });
      if (existing) {
        await prisma.orderItem.update({ where: { id: v1Id }, data: data });
      } else {
        await prisma.orderItem.create({ data });
      }
      stats.orderItems++;
    }

    // ==================== 验证 ====================
    console.log('\n=== 迁移验证 ===');
    await verify(prisma, { users, categories, units, commodities, orders, ordercommodities });

    // 摘要
    console.log('\n=== 迁移摘要 ===');
    console.log(JSON.stringify(stats, null, 2));
    console.log('迁移完成 ✅');
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

// ==================== 转换辅助 ====================

export interface V1Record {
  _id: unknown;
  [key: string]: unknown;
}

/** V1 deleted 布尔 → V3 deletedAt */
export function toDeletedAt(v1: V1Record): Date | null {
  if (v1.deleted === true) {
    return toDate(v1.update_at) || new Date();
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
  // ObjectId 实例或已有字符串
  return String(v);
}

/**
 * 字段映射：V1 → V3 字段名
 * - desc → description
 * - count → quantity
 * - price → unitPrice
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


// ==================== 验证 ====================

interface VerifyInput {
  users: V1Record[];
  categories: V1Record[];
  units: V1Record[];
  commodities: V1Record[];
  orders: V1Record[];
  ordercommodities: V1Record[];
}

async function verify(prisma: PrismaClient, v1: VerifyInput) {
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
  const countOk = Object.keys(counts).every(
    (k) => counts[k as keyof typeof counts] === v1Counts[k as keyof typeof v1Counts],
  );
  console.log(`记录数: ${countOk ? '✅' : '❌'}`);
  if (!countOk) {
    console.log('  V3:', JSON.stringify(counts));
    console.log('  V1:', JSON.stringify(v1Counts));
  }

  // 2. 金额汇总
  const v3Sum = await prisma.orderItem.aggregate({ _sum: { lineTotal: true } });
  const v1Sum = v1.ordercommodities
    .filter((o) => !(o as V1Record).deleted)
    .reduce((s, o) => s + Number((o as V1Record).lineTotal || 0), 0);
  const sumOk = Math.abs(Number(v3Sum._sum.lineTotal || 0) - v1Sum) < 0.01;
  console.log(`SUM(lineTotal): ${sumOk ? '✅' : '❌'} (V3=${v3Sum._sum.lineTotal}, V1=${v1Sum})`);

  // 3. 外键完整性
  const orderItems = await prisma.orderItem.findMany({ where: { deletedAt: null } });
  const orderIds = new Set((await prisma.order.findMany({ select: { id: true } })).map((o) => o.id));
  const commodityIds = new Set((await prisma.commodity.findMany({ select: { id: true } })).map((c) => c.id));
  const fkOrderOk = orderItems.every((i) => orderIds.has(i.orderId));
  const fkCommodityOk = orderItems.every((i) => commodityIds.has(i.commodityId));
  console.log(`外键 orderId: ${fkOrderOk ? '✅' : '❌'}`);
  console.log(`外键 commodityId: ${fkCommodityOk ? '✅' : '❌'}`);

  // 4. 密码可登录（抽样第一个非删除用户）
  const firstUser = v1.users.find((u) => !(u as V1Record).deleted) as V1Record | undefined;
  if (firstUser) {
    const hash = String(firstUser.passwordHash || firstUser.password_hash || '');
    const loginOk = hash ? await bcrypt.compare('', hash).catch(() => false) : false;
    // 密码可登录验证需真实密码，这里仅检查 hash 存在
    console.log(`密码哈希: ${hash ? '✅ 存在（真实登录需正确密码验证）' : '❌ 缺失'}（用户: ${firstUser.username}）`);
  } else {
    console.log('密码验证: ⏭ 无用户');
  }
}

// 直接运行（pnpm db:migrate-from-v1）时执行；被测试 import 时不触发
if (require.main === module) {
  main().catch((e) => {
    console.error('迁移失败:', e);
    process.exit(1);
  });
}

