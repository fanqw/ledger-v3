import { toDeletedAt, toDate, toHexId, mapFields, runMigration } from './migrate-from-v1';

describe('migrate-from-v1 转换函数', () => {
  describe('toDeletedAt', () => {
    it('deleted=true 时返回 updatedAt', () => {
      const d = new Date('2024-01-01T00:00:00Z');
      expect(toDeletedAt({ _id: 'a', deleted: true, update_at: d })).toEqual(d);
    });

    it('deleted=false 时返回 null', () => {
      expect(toDeletedAt({ _id: 'a', deleted: false })).toBeNull();
    });

    it('deleted 缺失时返回 null', () => {
      expect(toDeletedAt({ _id: 'a' })).toBeNull();
    });
  });

  describe('toDate', () => {
    it('接受 Date', () => {
      const d = new Date('2024-06-01T00:00:00Z');
      expect(toDate(d)).toEqual(d);
    });

    it('接受 ISO 字符串', () => {
      const d = toDate('2024-06-01T00:00:00Z');
      expect(d?.toISOString()).toBe('2024-06-01T00:00:00.000Z');
    });

    it('空值返回 null', () => {
      expect(toDate(null)).toBeNull();
      expect(toDate(undefined)).toBeNull();
    });

    it('非法字符串返回 null', () => {
      expect(toDate('not-a-date')).toBeNull();
    });
  });

  describe('toHexId', () => {
    it('ObjectId 对象转为 hex 字符串', () => {
      const oid = { toString: () => '507f1f77bcf86cd799439011' };
      expect(toHexId(oid)).toBe('507f1f77bcf86cd799439011');
    });

    it('字符串原样返回', () => {
      expect(toHexId('abc123')).toBe('abc123');
    });

    it('空值返回空字符串', () => {
      expect(toHexId(null)).toBe('');
      expect(toHexId(undefined)).toBe('');
    });
  });

  describe('mapFields', () => {
    it('映射 desc/count/price/create_at/update_at', () => {
      const result = mapFields({
        _id: 'x',
        name: '商品',
        desc: '备注',
        count: 3,
        price: 5.5,
        create_at: '2024-01-01',
        update_at: '2024-01-02',
      });
      expect(result.description).toBe('备注');
      expect(result.quantity).toBe(3);
      expect(result.unitPrice).toBe(5.5);
      expect(result.createdAt).toBe('2024-01-01');
      expect(result.updatedAt).toBe('2024-01-02');
      // _id 不进入映射结果（单独处理）
      expect(result._id).toBeUndefined();
      // 未映射字段保留原名
      expect(result.name).toBe('商品');
    });

    it('无映射字段时保留原样', () => {
      const result = mapFields({ name: 'x', deleted: false });
      expect(result).toEqual({ name: 'x', deleted: false });
    });
  });
});

// ==================== runMigration 集成测试 ====================

describe('runMigration', () => {
  const upsert = jest.fn();
  const findFirst = jest.fn();
  const count = jest.fn();
  const findMany = jest.fn();
  const aggregate = jest.fn();
  const prisma = {
    user: { upsert, count, findFirst },
    category: { upsert, count },
    unit: { upsert, count },
    commodity: { upsert, count, findMany },
    order: { upsert, count, findMany },
    orderItem: { upsert, count, findMany, aggregate },
    $disconnect: jest.fn(),
  };

  function makeClient(collections: Record<string, unknown[]>) {
    return {
      db: () => ({
        collection: (name: string) => ({
          find: () => ({ toArray: async () => collections[name] || [] }),
        }),
      }),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    upsert.mockResolvedValue({});
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    aggregate.mockResolvedValue({ _sum: { lineTotal: null } });
  });

  it('按字段映射导入用户（desc→description、role 默认 admin）', async () => {
    const client = makeClient({
      users: [{ _id: { toString: () => 'u1' }, username: 'alice', passwordHash: 'h1', desc: '备注', create_at: '2024-01-01' }],
      category: [], unit: [], commodity: [], order: [], ordercommodity: [],
    });
    
    const result = await runMigration(prisma as never, client as never);
    // upsert 被调用且包含转换后的字段
    const call = upsert.mock.calls[0][0];
    expect(call.create.username).toBe('alice');
    expect(call.create.role).toBe('admin');
    expect(call.create.id).toBe('u1');
    expect(result.stats.users).toBe(1);
  });

  it('外键缺失时跳过 commodity 并记录 skip', async () => {
    const client = makeClient({
      users: [], category: [], unit: [],
      commodity: [{ _id: { toString: () => 'c1' }, name: 'x', category_id: 'nonexistent', unit_id: 'u1' }],
      order: [], ordercommodity: [],
    });
    
    const result = await runMigration(prisma as never, client as never);
    expect(result.stats.skipped).toBe(1);
    expect(result.skips.length).toBe(1);
    expect(result.skips[0]).toContain('c1');
  });

  it('验证失败时返回 failures（不抛异常）', async () => {
    const client = makeClient({
      users: [{ _id: { toString: () => 'u1' }, username: 'alice', passwordHash: 'h1' }],
      category: [], unit: [], commodity: [], order: [], ordercommodity: [],
    });
    // 记录数不匹配：V3 count 返回 0，V1 有 1 个非删除用户
    count.mockResolvedValue(0);
    
    const result = await runMigration(prisma as never, client as never);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures.join(' ')).toContain('users');
  });

  it('软删除记录不参与记录数验证（deleted=true 被排除）', async () => {
    const client = makeClient({
      users: [
        { _id: { toString: () => 'u1' }, username: 'a', passwordHash: 'h', deleted: false },
        { _id: { toString: () => 'u2' }, username: 'b', passwordHash: 'h', deleted: true, update_at: '2024-01-01' },
      ],
      category: [], unit: [], commodity: [], order: [], ordercommodity: [],
    });
    count.mockResolvedValue(1); // V3 应有 1 个非删除用户

    const result = await runMigration(prisma as never, client as never);
    // 记录数验证应通过（V3=1 == V1 非删除=1）
    expect(result.failures.some((f) => f.includes('users'))).toBe(false);
  });

  it('lineTotal 用 count × price 整数四舍五入（对齐 V1 $round）', async () => {
    const client = makeClient({
      users: [],
      category: [{ _id: { toString: () => 'cat1' }, name: '蔬菜' }],
      unit: [{ _id: { toString: () => 'u1' }, name: '千克' }],
      commodity: [{ _id: { toString: () => 'c1' }, name: '蒜苗', category_id: 'cat1', unit_id: 'u1' }],
      order: [{ _id: { toString: () => 'o1' }, name: '订单' }],
      order_commodity: [
        // count × price 有小数：1.7×49=83.3 → $round → 83（非 83.3）
        { _id: { toString: () => 'i1' }, order_id: 'o1', commodity_id: 'c1', count: 49, price: 1.7 },
        // 4 位小数单价：0.7497×2341=1755.0477 → $round → 1755
        { _id: { toString: () => 'i2' }, order_id: 'o1', commodity_id: 'c1', count: 2341, price: 0.7497 },
      ],
    });
    count.mockResolvedValue(0);

    await runMigration(prisma as never, client as never);
    const itemCalls = upsert.mock.calls.filter((c) => c[0].create?.lineTotal);
    expect(itemCalls.length).toBe(2);
    expect(Number(itemCalls[0][0].create.lineTotal)).toBe(83);
    expect(Number(itemCalls[1][0].create.lineTotal)).toBe(1755);
    // 单价原样保留（Decimal 4 位精度，不被舍入）
    expect(String(itemCalls[1][0].create.unitPrice)).toBe('0.7497');
  });
});
