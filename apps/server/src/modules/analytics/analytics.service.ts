import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type {
  AnalyticsKpis,
  AnalyticsDailyTrendItem,
  AnalyticsTopCommodities,
  AnalyticsCategoryShare,
  AnalyticsPurchasePlaceShare,
  AnalyticsOrderSizeBucket,
  AnalyticsWorkbenchResponse,
} from '@ledger-v3/shared/validators';

// 订单明细（含关联 commodity/category）
interface ItemRow {
  id: string;
  quantity: any;
  unitPrice: any;
  lineTotal: any;
  commodityId: string;
  commodity: {
    id: string;
    name: string;
    category: { id: string; name: string } | null;
    unit: { id: string; name: string } | null;
  };
}

// 订单（含 items + purchasePlace）
interface OrderRow {
  id: string;
  name: string;
  description?: string | null;
  createdAt: Date | string;
  purchasePlaceId: string | null;
  purchasePlace: { id: string; place: string; marketName: string } | null;
  items: ItemRow[];
}

const BUCKETS: { key: AnalyticsOrderSizeBucket['bucket']; min: number; max: number }[] = [
  { key: '0-1k', min: 0, max: 1000 },
  { key: '1k-5k', min: 1000, max: 5000 },
  { key: '5k-10k', min: 5000, max: 10000 },
  { key: '10k-50k', min: 10000, max: 50000 },
  { key: '50k+', min: 50000, max: Number.POSITIVE_INFINITY },
];

const SLOT_COUNT = 8;

/**
 * ==================== AnalyticsService（数据分析聚合）====================
 *
 * 职责：把时间范围内的订单数据聚合成工作台图表数据。纯内存计算——
 * 一次查询拉回订单（含明细+商品+分类+单位），后续全部用 JS 函数处理。
 *
 * 设计要点（学习的核心）：
 * 1. 金额精度策略：所有金额先转「整数分」再计算（toFen），最后再转回「元」。
 *    避免二进制浮点累计误差（0.1 + 0.2 ≠ 0.3 的问题）。
 * 2. 纯函数设计：compute(orders) 不访问数据库，输入输出都是普通数据，
 *    因此每个 computeXxx 都能独立单元测试。
 * 3. 时间边界：getWorkbench 用半开区间 [start 00:00, end+1天 00:00)，
 *    按 Asia/Shanghai (+08:00) 解释，避免 Date 的 UTC 偏移造成「少算一天」。
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 工作台聚合入口
   * 1. 把 [start, end] 转成查询边界：gte = start 00:00，lt = end+1天 00:00
   *    （半开区间保证 end 当天 23:59:59 以内的订单都被包含）
   * 2. 一次 findMany 拉回订单 + 明细 + 商品（含分类/单位）+ 进货地
   * 3. 交给 compute() 做全部聚合（纯函数）
   */
  async getWorkbench(start: string, end: string): Promise<AnalyticsWorkbenchResponse> {
    // 边界：半开区间 [start 00:00, end+1day 00:00)，按 Asia/Shanghai 解释
    const gte = new Date(`${start}T00:00:00+08:00`);
    const lt = new Date(`${end}T00:00:00+08:00`);
    lt.setDate(lt.getDate() + 1);

    const orders = (await this.prisma.order.findMany({
      where: { deletedAt: null, createdAt: { gte, lt } },
      include: {
        items: {
          where: { deletedAt: null },
          include: { commodity: { include: { category: true, unit: true } } },
        },
        purchasePlace: true,
      },
      orderBy: { createdAt: 'asc' },
    })) as unknown as OrderRow[];

    return this.compute(orders);
  }

  // ==================== 聚合 ====================

  /**
   * 聚合调度：依次计算 6 块数据，组装成完整响应
   * 纯函数——输入订单数组，输出图表数据，不碰数据库
   */
  private compute(orders: OrderRow[]): AnalyticsWorkbenchResponse {
    const kpis = this.computeKpis(orders);
    const dailyTrend = this.computeDailyTrend(orders);
    const topCommodities = this.computeTopCommodities(orders);
    const categoryShare = this.computeCategoryShare(orders);
    const purchasePlaceShare = this.computePurchasePlaceShare(orders);
    const orderSizeDistribution = this.computeOrderSizeDistribution(orders);

    return {
      kpis,
      dailyTrend,
      topCommodities,
      categoryShare,
      purchasePlaceShare,
      orderSizeDistribution,
    };
  }

  // 金额转整数"分"（避免浮点误差）
  private toFen(value: number): number {
    return Math.round(value * 100);
  }
  // Decimal → number（兼容 Prisma Decimal 对象与 mock { toNumber }）
  private decimalToNumber(v: unknown): number {
    if (v && typeof v === 'object' && 'toNumber' in (v as object)) {
      return (v as { toNumber: () => number }).toNumber();
    }
    return Number(v);
  }
  // 分 → 元（round2）
  private fenToYuan(fen: number): number {
    return Math.round(fen) / 100;
  }
  // quantity 转整数"千分位"
  private toMilli(value: number): number {
    return Math.round(value * 1000);
  }
  /** 千分位 → 数量（保留 3 位小数） */
  private milliToNumber(milli: number): number {
    return Math.round(milli) / 1000;
  }
  /** 保留 1 位小数（百分比/客单价用） */
  private round1(value: number): number {
    return Math.round(value * 10) / 10;
  }
  /** Date/ISO 字符串 → 'YYYY-MM-DD'（本地时区；用于每日趋势的 X 轴分组键） */
  private formatDate(d: Date | string): string {
    const dt = typeof d === 'string' ? new Date(d) : d;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * KPI×4：总金额 / 订单数 / 商品种数 / 客单价（平均每单金额）
   * - totalFen 累计所有明细金额（分）；commodityIds Set 去重统计商品种数
   * - avgOrderAmount = 总金额分 ÷ 订单数（元，保留 1 位）；无订单时为 0
   */
  private computeKpis(orders: OrderRow[]): AnalyticsKpis {
    let totalFen = 0;
    const commodityIds = new Set<string>();
    for (const o of orders) {
      for (const it of o.items) {
        totalFen += this.toFen(this.decimalToNumber(it.lineTotal));
        commodityIds.add(it.commodityId);
      }
    }
    const orderCount = orders.length;
    const totalAmount = this.fenToYuan(totalFen);
    const avgOrderAmount = orderCount > 0 ? this.round1(Math.round(totalFen / orderCount) / 100) : 0;
    return {
      totalAmount,
      orderCount,
      commodityCount: commodityIds.size,
      avgOrderAmount,
    };
  }

  /**
   * 每日趋势：按天分组 → 每天最多展示 SLOT_COUNT(8) 条订单，其余归入 other
   * 学习点（前端堆叠图的数据契约）：
   * - 每天先按「金额降序 → 时间升序 → id 升序」稳定排序
   * - 前 8 条 → slotAmounts[0..7]（堆叠图的 8 个柱槽位）
   * - 不足 8 条用 0 补位 → X 轴每天高度基准一致
   * - 第 9 条之后 → otherAmount（金额汇总）+ otherCount（条数）
   * - 结果按日期升序输出
   */
  private computeDailyTrend(orders: OrderRow[]): AnalyticsDailyTrendItem[] {
    const byDate = new Map<string, OrderRow[]>();
    for (const o of orders) {
      const d = this.formatDate(o.createdAt);
      const list = byDate.get(d) ?? [];
      list.push(o);
      byDate.set(d, list);
    }

    const result: AnalyticsDailyTrendItem[] = [];
    for (const [date, dayOrders] of byDate) {
      // 排序：金额降序 → createdAt 升序 → id 升序
      const sorted = [...dayOrders].sort((a, b) => {
        const aAmt = this.orderAmountFen(a);
        const bAmt = this.orderAmountFen(b);
        if (aAmt !== bAmt) return bAmt - aAmt;
        const aT = new Date(a.createdAt).getTime();
        const bT = new Date(b.createdAt).getTime();
        if (aT !== bT) return aT - bT;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });

      const top = sorted.slice(0, SLOT_COUNT);
      const rest = sorted.slice(SLOT_COUNT);

      const slotAmounts = top.map((o) => this.fenToYuan(this.orderAmountFen(o)));
      // 补足 8 位
      while (slotAmounts.length < SLOT_COUNT) slotAmounts.push(0);

      const otherFen = rest.reduce((sum, o) => sum + this.orderAmountFen(o), 0);
      const totalFen = dayOrders.reduce((sum, o) => sum + this.orderAmountFen(o), 0);

      result.push({
        date,
        total: this.fenToYuan(totalFen),
        slotAmounts,
        otherAmount: this.fenToYuan(otherFen),
        otherCount: rest.length,
        orders: top.map((o) => ({ id: o.id, name: o.name, amount: this.fenToYuan(this.orderAmountFen(o)) })),
      });
    }

    // 按日期升序
    result.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return result;
  }

  /** 单笔订单总金额（分）——该订单所有未删除明细 lineTotal 之和 */
  private orderAmountFen(order: OrderRow): number {
    return order.items.reduce((sum, it) => sum + this.toFen(this.decimalToNumber(it.lineTotal)), 0);
  }

  /**
   * 热购 Top10：按金额、按数量两个维度各取前 10
   * - 先按商品聚合：金额累计（分）+ 数量累计（千分位）+ 单位
   * - 再分别按金额/数量降序；排序用「名称→id」tiebreak 保证结果确定性
   *   （相同金额时顺序固定，前端图表不会随机跳动）
   */
  private computeTopCommodities(orders: OrderRow[]): AnalyticsTopCommodities {
    const map = new Map<string, { commodityId: string; name: string; unit: string; amountFen: number; quantityMilli: number }>();
    for (const o of orders) {
      for (const it of o.items) {
        const cid = it.commodityId;
        const entry = map.get(cid) ?? { commodityId: cid, name: it.commodity?.name || '未知', unit: it.commodity?.unit?.name || '', amountFen: 0, quantityMilli: 0 };
        entry.amountFen += this.toFen(this.decimalToNumber(it.lineTotal));
        entry.quantityMilli += this.toMilli(this.decimalToNumber(it.quantity));
        map.set(cid, entry);
      }
    }

    const entries = [...map.values()].map((e) => ({
      commodityId: e.commodityId,
      name: e.name,
      unit: e.unit,
      amount: this.fenToYuan(e.amountFen),
      quantity: this.milliToNumber(e.quantityMilli),
    }));

    const byAmount = [...entries].sort((a, b) =>
      b.amount - a.amount || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.commodityId < b.commodityId ? -1 : 1),
    );
    const byQuantity = [...entries].sort((a, b) =>
      b.quantity - a.quantity || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.commodityId < b.commodityId ? -1 : 1),
    );

    return {
      byAmount: byAmount.slice(0, 10),
      byQuantity: byQuantity.slice(0, 10),
    };
  }

  /**
   * 分类占比：每个分类的金额 + 占比 + 覆盖商品数/订单数
   * - 按明细的 commodity.category 归组；无分类商品归 '__none__'（前端显示「未分类」）
   * - percentage = 该分类金额分 ÷ 全部金额分 × 100（保留 1 位）
   * - 降序排列（金额多在前）；Set 去重统计商品数/订单数
   */
  private computeCategoryShare(orders: OrderRow[]): AnalyticsCategoryShare[] {
    const map = new Map<string, { categoryId: string; name: string; amountFen: number; commodityIds: Set<string>; orderIds: Set<string> }>();
    let totalFen = 0;
    for (const o of orders) {
      for (const it of o.items) {
        const cat = it.commodity?.category;
        const cid = cat?.id || '__none__';
        const entry = map.get(cid) ?? { categoryId: cat?.id || '__none__', name: cat?.name || '未分类', amountFen: 0, commodityIds: new Set(), orderIds: new Set() };
        entry.amountFen += this.toFen(this.decimalToNumber(it.lineTotal));
        entry.commodityIds.add(it.commodityId);
        entry.orderIds.add(o.id);
        map.set(cid, entry);
        totalFen += this.toFen(this.decimalToNumber(it.lineTotal));
      }
    }

    const result = [...map.values()]
      .map((e) => ({
        categoryId: e.categoryId,
        name: e.name,
        amount: this.fenToYuan(e.amountFen),
        percentage: totalFen > 0 ? this.round1((e.amountFen / totalFen) * 100) : 0,
        commodityCount: e.commodityIds.size,
        orderCount: e.orderIds.size,
      }))
      .sort((a, b) =>
        b.amount - a.amount || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.categoryId < b.categoryId ? -1 : 1),
      );
    return result;
  }

  /**
   * 进货地占比：按订单归组（进货地挂在订单上，不在明细上）
   * - 金额 = 该进货地所有订单的 orderAmountFen 之和
   * - 无进货地订单归 '未指定'（purchasePlaceId = null），排序压到最末尾
   * - percentage / orderCount（去重订单数）同分类占比模式
   */
  private computePurchasePlaceShare(orders: OrderRow[]): AnalyticsPurchasePlaceShare[] {
    const map = new Map<string, { purchasePlaceId: string | null; name: string; amountFen: number; orderIds: Set<string> }>();
    let totalFen = 0;
    for (const o of orders) {
      const pid = o.purchasePlaceId;
      const key = pid || '__none__';
      const name = o.purchasePlace ? `${o.purchasePlace.place} - ${o.purchasePlace.marketName}` : '未指定';
      const entry = map.get(key) ?? { purchasePlaceId: pid, name, amountFen: 0, orderIds: new Set() };
      entry.amountFen += this.orderAmountFen(o);
      entry.orderIds.add(o.id);
      map.set(key, entry);
      totalFen += this.orderAmountFen(o);
    }

    const result = [...map.values()]
      .map((e) => ({
        purchasePlaceId: e.purchasePlaceId,
        name: e.name,
        amount: this.fenToYuan(e.amountFen),
        percentage: totalFen > 0 ? this.round1((e.amountFen / totalFen) * 100) : 0,
        orderCount: e.orderIds.size,
      }))
      .sort((a, b) => {
        // "未指定"（null）置于末尾
        const aNull = a.purchasePlaceId === null ? 1 : 0;
        const bNull = b.purchasePlaceId === null ? 1 : 0;
        if (aNull !== bNull) return aNull - bNull;
        return b.amount - a.amount || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      });
    return result;
  }

  /**
   * 订单规模分布：按订单总金额分桶计数（直方图数据）
   * BUCKETS 定义在文件顶部：0-1k / 1k-5k / 5k-10k / 10k-50k / 50k+
   * 边界规则（注意首桶特殊）：
   * - 首桶 [0, 1000]：两端都含（金额恰好 1000 算第一桶）
   * - 其余 (min, max]：左开右闭（恰好 5000 算第二桶 1k-5k）
   * 遍历订单，找到第一个命中的桶计数 +1
   */
  private computeOrderSizeDistribution(orders: OrderRow[]): AnalyticsOrderSizeBucket[] {
    const counts = new Map<AnalyticsOrderSizeBucket['bucket'], number>();
    for (const b of BUCKETS) counts.set(b.key, 0);

    for (const o of orders) {
      const fen = this.orderAmountFen(o);
      const yuan = this.fenToYuan(fen);
      for (const b of BUCKETS) {
        // 首桶含 0：yuan >= 0 && yuan <= 1000；其余 (min, max]
        const inBucket = b.min === 0 ? yuan >= 0 && yuan <= b.max : yuan > b.min && yuan <= b.max;
        if (inBucket) {
          counts.set(b.key, (counts.get(b.key) || 0) + 1);
          break;
        }
      }
    }

    return BUCKETS.map((b) => ({ bucket: b.key, count: counts.get(b.key) || 0 }));
  }
}
