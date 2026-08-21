import { AnalyticsService } from '../analytics.service';

// 构造一个 order mock（含 items + purchasePlace）
function makeOrder(overrides: any) {
  const base = {
    id: 'order-1',
    name: '订单1',
    createdAt: '2026-07-15T10:00:00.000Z',
    purchasePlaceId: null,
    purchasePlace: null,
    items: [],
  };
  return { ...base, ...overrides };
}

function makeItem(overrides: any) {
  const base = {
    id: 'item-1',
    quantity: { toNumber: () => 2 },
    unitPrice: { toNumber: () => 5 },
    lineTotal: { toNumber: () => 10 },
    commodityId: 'commodity-1',
    commodity: {
      id: 'commodity-1',
      name: '商品A',
      category: { id: 'cat-1', name: '分类1' },
    },
  };
  return { ...base, ...overrides };
}

describe('AnalyticsService', () => {
  const prisma = {
    order: { findMany: jest.fn(), count: jest.fn() },
  };
  const service = new AnalyticsService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('KPI', () => {
    it('空数据返回全零 KPI 与空数组、恒 5 桶', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      const result = await service.getWorkbench('2026-01-01', '2026-12-31');
      expect(result.kpis).toEqual({
        totalAmount: 0,
        orderCount: 0,
        commodityCount: 0,
        avgOrderAmount: 0,
      });
      expect(result.dailyTrend).toEqual([]);
      expect(result.topCommodities.byAmount).toEqual([]);
      expect(result.topCommodities.byQuantity).toEqual([]);
      expect(result.categoryShare).toEqual([]);
      expect(result.purchasePlaceShare).toEqual([]);
      expect(result.orderSizeDistribution).toEqual([
        { bucket: '0-1k', count: 0 },
        { bucket: '1k-5k', count: 0 },
        { bucket: '5k-10k', count: 0 },
        { bucket: '10k-50k', count: 0 },
        { bucket: '50k+', count: 0 },
      ]);
    });

    it('计算采购总金额、订单数、商品种类、平均订单金额', async () => {
      prisma.order.findMany.mockResolvedValue([
        makeOrder({
          id: 'o1', createdAt: '2026-07-01T10:00:00Z',
          items: [
            makeItem({ commodityId: 'c1', lineTotal: { toNumber: () => 100 } }),
            makeItem({ commodityId: 'c1', lineTotal: { toNumber: () => 50 } }),
          ],
        }),
        makeOrder({
          id: 'o2', createdAt: '2026-07-02T10:00:00Z',
          items: [makeItem({ commodityId: 'c2', lineTotal: { toNumber: () => 30 } })],
        }),
      ]);
      const result = await service.getWorkbench('2026-07-01', '2026-07-31');
      expect(result.kpis).toEqual({
        totalAmount: 180,
        orderCount: 2,
        commodityCount: 2, // c1 去重
        avgOrderAmount: 90,
      });
    });

    it('订单总数为 0 时平均订单金额为 0', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      const result = await service.getWorkbench('2026-07-01', '2026-07-31');
      expect(result.kpis.avgOrderAmount).toBe(0);
    });
  });

  describe('每日趋势', () => {
    it('按日分组返回 slotAmounts/orders/other，且符合一致性约束', async () => {
      prisma.order.findMany.mockResolvedValue([
        makeOrder({
          id: 'o1', name: 'A', createdAt: '2026-07-01T08:00:00Z',
          items: [{ ...makeItem({}), lineTotal: { toNumber: () => 100 } }],
        }),
        makeOrder({
          id: 'o2', name: 'B', createdAt: '2026-07-01T09:00:00Z',
          items: [{ ...makeItem({}), lineTotal: { toNumber: () => 200 } }],
        }),
      ]);
      const result = await service.getWorkbench('2026-07-01', '2026-07-02');
      expect(result.dailyTrend).toHaveLength(1);
      const day = result.dailyTrend[0];
      expect(day.date).toBe('2026-07-01');
      expect(day.orders).toHaveLength(2);
      // 金额降序：B(200) 在前
      expect(day.orders[0].name).toBe('B');
      expect(day.orders[0].amount).toBe(200);
      expect(day.orders[1].name).toBe('A');
      expect(day.orders[1].amount).toBe(100);
      // slotAmounts[i] === orders[i].amount
      expect(day.slotAmounts[0]).toBe(200);
      expect(day.slotAmounts[1]).toBe(100);
      // total === sum(slotAmounts) + otherAmount
      expect(day.total).toBe(300);
      expect(day.otherAmount).toBe(0);
      expect(day.otherCount).toBe(0);
    });

    it('单日 > 8 笔时聚合 other 块且 otherCount 正确', async () => {
      const orders = Array.from({ length: 10 }, (_, i) =>
        makeOrder({
          id: `o${i}`, name: `订单${i}`,
          createdAt: '2026-07-01T08:00:00Z',
          items: [{ ...makeItem({}), lineTotal: { toNumber: () => i + 1 } }],
        }),
      );
      prisma.order.findMany.mockResolvedValue(orders);
      const result = await service.getWorkbench('2026-07-01', '2026-07-02');
      const day = result.dailyTrend[0];
      expect(day.orders).toHaveLength(8);
      expect(day.otherCount).toBe(2);
      // otherAmount = 其余 2 笔之和（金额最高的 8 笔在前，其余为最小 2 笔：1+2=3）
      expect(day.otherAmount).toBe(3);
      // slotAmounts 8 元素
      expect(day.slotAmounts).toHaveLength(8);
      // total === sum(slotAmounts) + otherAmount
      const sum = day.slotAmounts.reduce((a, b) => a + b, 0);
      expect(day.total).toBe(sum + day.otherAmount);
    });

    it('相同金额按 createdAt 升序、再按 id 升序', async () => {
      prisma.order.findMany.mockResolvedValue([
        makeOrder({ id: 'oB', name: 'B', createdAt: '2026-07-01T09:00:00Z', items: [{ ...makeItem({}), lineTotal: { toNumber: () => 50 } }] }),
        makeOrder({ id: 'oA', name: 'A', createdAt: '2026-07-01T08:00:00Z', items: [{ ...makeItem({}), lineTotal: { toNumber: () => 50 } }] }),
      ]);
      const result = await service.getWorkbench('2026-07-01', '2026-07-02');
      expect(result.dailyTrend[0].orders[0].id).toBe('oA');
      expect(result.dailyTrend[0].orders[1].id).toBe('oB');
    });

    it('时间过滤：createdAt 在 [start, end+1day) 区间内的才计入', async () => {
      prisma.order.findMany.mockResolvedValue([
        makeOrder({ id: 'in', createdAt: '2026-07-15T12:00:00Z', items: [{ ...makeItem({}), lineTotal: { toNumber: () => 10 } }] }),
        makeOrder({ id: 'out-before', createdAt: '2026-06-30T23:59:59Z', items: [{ ...makeItem({}), lineTotal: { toNumber: () => 10 } }] }),
        makeOrder({ id: 'out-after', createdAt: '2026-08-01T00:00:00Z', items: [{ ...makeItem({}), lineTotal: { toNumber: () => 10 } }] }),
      ]);
      // 断言查询条件
      await service.getWorkbench('2026-07-01', '2026-07-31');
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: expect.any(Date), lt: expect.any(Date) },
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe('热购排行', () => {
    it('按金额/数量降序取前 10，含名称与去重', async () => {
      const orders = [
        makeOrder({
          id: 'o1', createdAt: '2026-07-01T08:00:00Z',
          items: [
            makeItem({ commodityId: 'c1', commodity: { id: 'c1', name: '商品A', category: { id: 'cat1', name: 'C1' } }, quantity: { toNumber: () => 1 }, lineTotal: { toNumber: () => 10 } }),
            makeItem({ commodityId: 'c2', commodity: { id: 'c2', name: '商品B', category: { id: 'cat2', name: 'C2' } }, quantity: { toNumber: () => 2 }, lineTotal: { toNumber: () => 20 } }),
          ],
        }),
        makeOrder({
          id: 'o2', createdAt: '2026-07-02T08:00:00Z',
          items: [
            makeItem({ commodityId: 'c1', commodity: { id: 'c1', name: '商品A', category: { id: 'cat1', name: 'C1' } }, quantity: { toNumber: () => 3 }, lineTotal: { toNumber: () => 30 } }),
          ],
        }),
      ];
      prisma.order.findMany.mockResolvedValue(orders);
      const result = await service.getWorkbench('2026-07-01', '2026-07-31');
      // c1: 金额 40, 数量 4; c2: 金额 20, 数量 2
      expect(result.topCommodities.byAmount[0]).toMatchObject({ commodityId: 'c1', name: '商品A', amount: 40, quantity: 4 });
      expect(result.topCommodities.byAmount[1]).toMatchObject({ commodityId: 'c2', name: '商品B', amount: 20, quantity: 2 });
      expect(result.topCommodities.byQuantity[0]).toMatchObject({ commodityId: 'c1', quantity: 4 });
      expect(result.topCommodities.byQuantity[1]).toMatchObject({ commodityId: 'c2', quantity: 2 });
    });

    it('相同金额按名称升序', async () => {
      const orders = [
        makeOrder({
          id: 'o1', createdAt: '2026-07-01T08:00:00Z',
          items: [
            makeItem({ commodityId: 'c1', commodity: { id: 'c1', name: 'B品', category: { id: 'cat1', name: 'C1' } }, quantity: { toNumber: () => 1 }, lineTotal: { toNumber: () => 10 } }),
            makeItem({ commodityId: 'c2', commodity: { id: 'c2', name: 'A品', category: { id: 'cat2', name: 'C2' } }, quantity: { toNumber: () => 1 }, lineTotal: { toNumber: () => 10 } }),
          ],
        }),
      ];
      prisma.order.findMany.mockResolvedValue(orders);
      const result = await service.getWorkbench('2026-07-01', '2026-07-31');
      expect(result.topCommodities.byAmount[0].name).toBe('A品');
      expect(result.topCommodities.byAmount[1].name).toBe('B品');
    });
  });

  describe('分类与进货地占比', () => {
    it('分类占比含金额/占比/商品数/订单数', async () => {
      const orders = [
        makeOrder({
          id: 'o1', createdAt: '2026-07-01T08:00:00Z',
          items: [
            makeItem({ commodityId: 'c1', commodity: { id: 'c1', name: 'A', category: { id: 'cat1', name: '分类1' } }, lineTotal: { toNumber: () => 30 } }),
            makeItem({ commodityId: 'c2', commodity: { id: 'c2', name: 'B', category: { id: 'cat2', name: '分类2' } }, lineTotal: { toNumber: () => 10 } }),
          ],
        }),
      ];
      prisma.order.findMany.mockResolvedValue(orders);
      const result = await service.getWorkbench('2026-07-01', '2026-07-31');
      // 总额 40，分类1 占 30/40=75%，分类2 占 10/40=25%
      expect(result.categoryShare).toHaveLength(2);
      expect(result.categoryShare[0]).toMatchObject({ name: '分类1', amount: 30, percentage: 75, commodityCount: 1, orderCount: 1 });
      expect(result.categoryShare[1]).toMatchObject({ name: '分类2', amount: 10, percentage: 25 });
    });

    it('进货地占比含金额/占比/订单数，无进货地归未指定', async () => {
      const orders = [
        makeOrder({
          id: 'o1', createdAt: '2026-07-01T08:00:00Z',
          purchasePlaceId: 'pp1',
          purchasePlace: { id: 'pp1', place: '洛阳', marketName: '洪锦' },
          items: [{ ...makeItem({}), lineTotal: { toNumber: () => 30 } }],
        }),
        makeOrder({
          id: 'o2', createdAt: '2026-07-02T08:00:00Z',
          purchasePlaceId: null, purchasePlace: null,
          items: [{ ...makeItem({}), lineTotal: { toNumber: () => 10 } }],
        }),
      ];
      prisma.order.findMany.mockResolvedValue(orders);
      const result = await service.getWorkbench('2026-07-01', '2026-07-31');
      expect(result.purchasePlaceShare).toHaveLength(2);
      expect(result.purchasePlaceShare[0]).toMatchObject({ purchasePlaceId: 'pp1', name: '洛阳 - 洪锦', amount: 30, orderCount: 1 });
      expect(result.purchasePlaceShare[1]).toMatchObject({ purchasePlaceId: null, name: '未指定', amount: 10 });
    });
  });

  describe('订单规模分布', () => {
    it('半开区间分桶边界正确', async () => {
      const mk = (id: string, amount: number) =>
        makeOrder({
          id, createdAt: '2026-07-01T08:00:00Z',
          items: [{ ...makeItem({}), lineTotal: { toNumber: () => amount } }],
        });
      prisma.order.findMany.mockResolvedValue([
        mk('a', 1000),   // 0-1k
        mk('b', 5000),   // 1k-5k
        mk('c', 10000),  // 5k-10k
        mk('d', 50000),  // 10k-50k
        mk('e', 50000.01), // 50k+
        mk('f', 0),      // 0-1k
      ]);
      const result = await service.getWorkbench('2026-07-01', '2026-07-31');
      expect(result.orderSizeDistribution).toEqual([
        { bucket: '0-1k', count: 2 },
        { bucket: '1k-5k', count: 1 },
        { bucket: '5k-10k', count: 1 },
        { bucket: '10k-50k', count: 1 },
        { bucket: '50k+', count: 1 },
      ]);
    });
  });

  describe('精度', () => {
    it('金额整数分累加无浮点误差（0.1×3=0.3）', async () => {
      const orders = [
        makeOrder({
          id: 'o1', createdAt: '2026-07-01T08:00:00Z',
          items: [
            makeItem({ lineTotal: { toNumber: () => 0.1 } }),
            makeItem({ lineTotal: { toNumber: () => 0.2 } }),
          ],
        }),
      ];
      prisma.order.findMany.mockResolvedValue(orders);
      const result = await service.getWorkbench('2026-07-01', '2026-07-31');
      expect(result.kpis.totalAmount).toBe(0.3);
    });

    it('quantity 千分位累加无浮点误差（0.1+0.2=0.3）', async () => {
      const orders = [
        makeOrder({
          id: 'o1', createdAt: '2026-07-01T08:00:00Z',
          items: [
            makeItem({ commodityId: 'c1', commodity: { id: 'c1', name: 'A', category: { id: 'cat1', name: 'C' } }, quantity: { toNumber: () => 0.1 }, lineTotal: { toNumber: () => 1 } }),
            makeItem({ commodityId: 'c2', commodity: { id: 'c2', name: 'B', category: { id: 'cat2', name: 'C' } }, quantity: { toNumber: () => 0.2 }, lineTotal: { toNumber: () => 1 } }),
          ],
        }),
      ];
      prisma.order.findMany.mockResolvedValue(orders);
      const result = await service.getWorkbench('2026-07-01', '2026-07-31');
      // c1 quantity 0.1, c2 quantity 0.2（各一条明细，无累加，但验证千分位往返正确）
      const byQty = result.topCommodities.byQuantity;
      expect(byQty.find((c) => c.commodityId === 'c1')!.quantity).toBe(0.1);
      expect(byQty.find((c) => c.commodityId === 'c2')!.quantity).toBe(0.2);
    });
  });
});
