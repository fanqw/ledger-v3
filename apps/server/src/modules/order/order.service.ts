import { Injectable, ConflictException, NotFoundException, UnprocessableEntityException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

/**
 * ==================== OrderService（订单业务逻辑）====================
 *
 * 职责：订单 + 明细的全部业务规则。全系统最核心的模块。
 *
 * 理解本模块的三个关键设计：
 * 1. 金额用 Prisma Decimal 存（避免浮点误差），但返回给前端前统一转 number
 *    （serializeOrderItem + findById 里的 Number() 转换）
 * 2. lineTotal（金额）两种来源：
 *    - 用户手动填（可任意改，前端标红提示与数量×单价不一致）
 *    - 未填时后端自动算 = 数量 × 单价（roundToDecimal 保留 2 位）
 * 3. 明细的「即输即建」：addItem 的 Path B 允许一次调用同时创建
 *    「分类 → 单位 → 商品 → 明细」的整条链（按名称自动 upsert 逻辑）
 */
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== Order CRUD ====================

  /**
   * 生成默认订单名：YYYYMMDD-序号
   * 序号 = 今天（本地零点起）已创建的订单数 + 1（例如第 3 单 → 20260827-03）
   * 注意：这是「乐观」序号（没有并发锁），仅用于预填名称，用户可改
   */
  async getNextName() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await this.prisma.order.count({
      where: { deletedAt: null, createdAt: { gte: today } },
    });
    const seq = String(count + 1).padStart(2, '0');
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return { name: `${y}${m}${d}-${seq}` };
  }

  /**
   * 订单分页列表
   * keyword 搜索：订单名/备注 + 市场(市场名/所属城市) —— 用关系字段搜
   * 含 totalAmount（进货金额）：未删除明细 lineTotal 之和，用于列表展示；不含明细数组
   */
  async findAll(page: number, pageSize: number, keyword?: string) {
    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { market: { name: { contains: keyword, mode: 'insensitive' } } },
        { market: { city: { place: { contains: keyword, mode: 'insensitive' } } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          market: { include: { city: true } },
          items: { where: { deletedAt: null }, select: { lineTotal: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    const list = items.map(({ items: orderItems, ...order }) => ({
      ...order,
      totalAmount: orderItems.reduce((sum, item) => sum + Number(item.lineTotal), 0),
    }));
    return { items: list, meta: { page, pageSize, total } };
  }

  /**
   * 订单详情（含明细）——本模块的查询重点
   *
   * Prisma include 两层嵌套：
   *   order → items(仅未删除) → commodity → category + unit
   *   明细按「分类名 asc, 创建时间 asc」排序 → 前端可做分类分组小计
   *
   * 返回前对每条明细做计算（前端标红的数据源）：
   *   - computedLineTotal = round(数量 × 单价, 2)  —— 理论应得金额
   *   - isModified = |lineTotal − computedLineTotal| > 0.005
   *     —— 存储金额与理论值不一致 = 用户手动改过 → 前端显示红色
   *   - Decimal 字段（quantity/unitPrice/lineTotal）统一 Number() 转 number
   *
   * 订单不存在 → 404 NOT_FOUND
   */
  async findById(id: string) {
    const record = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: {
        market: { include: { city: true } },
        items: {
          where: { deletedAt: null },
          include: {
            commodity: {
              include: { category: true, unit: true },
            },
          },
          orderBy: [{ commodity: { category: { name: 'desc' } } }, { createdAt: 'desc' }],
        },
      },
    });
    if (!record)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    const items = (record.items || []).map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const lineTotal = Number(item.lineTotal);
      const computedLineTotal = this.roundToDecimal(quantity * unitPrice, 2);
      return {
        ...item,
        quantity,
        unitPrice,
        lineTotal,
        computedLineTotal,
        isModified: Math.abs(lineTotal - computedLineTotal) > 0.005,
        commodity: item.commodity
          ? { ...item.commodity, category: item.commodity.category || undefined, unit: item.commodity.unit || undefined }
          : undefined,
      };
    });

    return { ...record, items };
  }

  /**
   * 创建订单
   * 校验顺序：
   *   1. 若传了 marketId → 校验市场存在且未删除（缺失 422 VALIDATION_ERROR）
   *   2. 名称查重 → 重复 409 ORDER_EXISTS
   *   3. create + include market（返回带市场对象）
   * 注意：新建订单不带明细（明细通过 addItem 逐个加）
   */
  async create(data: { name: string; marketId?: string | null; description?: string }) {
    const name = data.name.trim();

    if (data.marketId) {
      const pp = await this.prisma.market.findFirst({
        where: { id: data.marketId, deletedAt: null },
      });
      if (!pp)
        throw new UnprocessableEntityException({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR] },
        });
    }

    const existing = await this.prisma.order.findFirst({
      where: { name, deletedAt: null },
    });
    if (existing)
      throw new ConflictException({
        success: false,
        error: { code: ERROR_CODES.ORDER_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.ORDER_EXISTS], existingId: existing.id },
      });

    return this.prisma.order.create({
      data: { name, description: data.description?.trim() || null, marketId: data.marketId || null },
      include: { market: { include: { city: true } } },
    });
  }

  /**
   * 更新订单
   * 学习点（Prisma 关系操作的两种写法）：
   * - marketId = null → { disconnect: true }  断开关系（清空市场）
   * - marketId = id  → 先校验存在，再 { connect: { id } }  连接关系
   * 改名查重排除自身（id: { not }）
   */
  async update(id: string, data: { name?: string; description?: string; marketId?: string | null }) {
    await this.findById(id);
    const updateData: Prisma.OrderUpdateInput = {};

    if (data.name !== undefined) {
      const name = data.name.trim();
      const existing = await this.prisma.order.findFirst({
        where: { name, deletedAt: null, id: { not: id } },
      });
      if (existing)
        throw new ConflictException({
          success: false,
          error: { code: ERROR_CODES.ORDER_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.ORDER_EXISTS], existingId: existing.id },
        });
      updateData.name = name;
    }
    if (data.description !== undefined) updateData.description = data.description.trim() || null;
    if (data.marketId !== undefined) {
      if (data.marketId === null) {
        // 显式清空市场
        updateData.market = { disconnect: true };
      } else {
        // connect 前校验存在性/软删除（与 create() 一致）
        const pp = await this.prisma.market.findFirst({
          where: { id: data.marketId, deletedAt: null },
        });
        if (!pp)
          throw new UnprocessableEntityException({
            success: false,
            error: { code: ERROR_CODES.VALIDATION_ERROR, message: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR] },
          });
        updateData.market = { connect: { id: data.marketId } };
      }
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData,
      include: { market: { include: { city: true } } },
    });
  }

  /**
   * 删除订单（软删除 + 明细保护）
   * $transaction：count 未删除明细 → 有明细抛 409 ORDER_HAS_ITEMS
   * （必须先删光明细才能删订单，保证不产生「孤儿明细」）→ 否则写 deletedAt
   */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.orderItem.count({ where: { orderId: id, deletedAt: null } });
      if (linked > 0)
        throw new ConflictException({
          success: false,
          error: { code: ERROR_CODES.ORDER_HAS_ITEMS, message: ERROR_MESSAGES[ERROR_CODES.ORDER_HAS_ITEMS] },
        });
      await tx.order.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true, data: null };
    });
  }

  // ==================== OrderItem CRUD ====================

  /**
   * 添加订单明细 —— 本模块核心方法，「即输即建」特性所在
   *
   * 两条路径（body 决定走哪条）：
   *   路径 A 引用已有商品：body 带 commodityId → 校验商品存在 → 直接建明细
   *   路径 B 即输即建：body 带 commodityName（新商品名）→ 后端自动解决
   *     「分类 → 单位 → 商品」的依赖链，商品不存在就现建，再挂明细
   *
   * 路径 B 依赖链（每个环节都「按名称查 → 没有再建」，天然幂等）：
   *   1. 分类：categoryId 直传(校验存在) 或 categoryName 按名查找/创建
   *   2. 单位：unitId 直传(校验存在) 或 unitName 按名查找/创建
   *   3. 商品：按「名称 + 单位」组合查 → 不存在则 create
   *   4. 明细：orderItem.create 挂到订单
   *   业务约束：即输即建必须同时给分类和单位（缺一个 → 422 VALIDATION_ERROR，
   *     否则 Prisma 必填关系缺失会抛 500）
   *
   * 统一：lineTotal 由前端计算后传入（前端实时算 数量×单价）；这里原样存。
   * 返回：明细 + 关联商品（含分类/单位），Decimal 字段已转 number
   */
  async addItem(
    orderId: string,
    data: {
      commodityId?: string;
      commodityName?: string;
      categoryId?: string;
      categoryName?: string;
      unitId?: string;
      unitName?: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      description?: string;
    },
  ) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!order)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    // Path A: existing commodity
    if (data.commodityId) {
      const commodity = await this.prisma.commodity.findFirst({
        where: { id: data.commodityId, deletedAt: null },
      });
      if (!commodity)
        throw new NotFoundException({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
        });

      const item = await this.prisma.orderItem.create({
        data: {
          orderId,
          commodityId: data.commodityId,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          lineTotal: data.lineTotal,
          description: data.description?.trim() || null,
        },
        include: { commodity: { include: { category: true, unit: true } } },
      });
      return this.serializeOrderItem(item);
    }

    // Path B: quick-create (sequential — master data NOT rolled back on OrderItem failure)
    // 业务约束：即输即建商品时必须同时提供分类和单位（与商品基础资料页一致），
    // 否则 Prisma 必填关系缺失会导致 500，这里显式转为 422 校验错误。
    if (!data.categoryId && !data.categoryName) {
      throw new UnprocessableEntityException({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: '即输即建商品时必须选择分类' },
      });
    }
    if (!data.unitId && !data.unitName) {
      throw new UnprocessableEntityException({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: '即输即建商品时必须选择单位' },
      });
    }

    let categoryId: string | undefined = data.categoryId;
    if (categoryId) {
      // 直传 id：校验存在性/软删除（与名称路径一致），避免 FK 500 或挂到已删除记录
      const cat = await this.prisma.category.findFirst({ where: { id: categoryId, deletedAt: null } });
      if (!cat)
        throw new UnprocessableEntityException({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR] },
        });
    } else if (data.categoryName) {
      const catName = data.categoryName.trim();
      let cat = await this.prisma.category.findFirst({ where: { name: catName, deletedAt: null } });
      if (!cat) {
        cat = await this.prisma.category.create({ data: { name: catName } });
      }
      categoryId = cat.id;
    }

    let unitId: string | undefined = data.unitId;
    if (unitId) {
      const unit = await this.prisma.unit.findFirst({ where: { id: unitId, deletedAt: null } });
      if (!unit)
        throw new UnprocessableEntityException({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR] },
        });
    } else if (data.unitName) {
      const unitName = data.unitName.trim();
      let unit = await this.prisma.unit.findFirst({ where: { name: unitName, deletedAt: null } });
      if (!unit) {
        unit = await this.prisma.unit.create({ data: { name: unitName } });
      }
      unitId = unit.id;
    }

    const commodityName = data.commodityName!.trim();
    let commodity = await this.prisma.commodity.findFirst({
      where: { name: commodityName, unitId: unitId!, deletedAt: null },
    });
    if (!commodity) {
      commodity = await this.prisma.commodity.create({
        data: { name: commodityName, categoryId: categoryId!, unitId: unitId! },
      });
    }

    const item = await this.prisma.orderItem.create({
      data: {
        orderId,
        commodityId: commodity.id,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        lineTotal: data.lineTotal,
        description: data.description?.trim() || null,
      },
      include: { commodity: { include: { category: true, unit: true } } },
    });
    return this.serializeOrderItem(item);
  }

  /**
   * 更新明细
   * 校验：订单存在（404）→ 明细属于该订单且未删除（404）—— orderId+itemId 双重定位，
   *   防止「拿着 A 订单的 itemId 去改 B 订单的明细」
   *
   * lineTotal 的计算逻辑（学习重点）：
   *   - body 显式传 lineTotal → 原样存（尊重用户手动改价）
   *   - 未传 lineTotal，但改了 quantity/unitPrice → 自动重算 round(数量×单价, 2)
   *   - 两者都没改 → lineTotal 不动
   * 返回：明细 + 关联商品，Decimal 转 number
   */
  async updateItem(
    orderId: string,
    itemId: string,
    data: { quantity?: number; unitPrice?: number; lineTotal?: number; description?: string },
  ) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!order)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, deletedAt: null },
    });
    if (!item)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    const updateData: Prisma.OrderItemUpdateInput = {};

    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice;
    if (data.description !== undefined) updateData.description = data.description.trim() || null;

    if (data.lineTotal !== undefined) {
      updateData.lineTotal = data.lineTotal;
    } else if (data.quantity !== undefined || data.unitPrice !== undefined) {
      const qty = data.quantity !== undefined ? data.quantity : Number(item.quantity);
      const price = data.unitPrice !== undefined ? data.unitPrice : Number(item.unitPrice);
      updateData.lineTotal = this.roundToDecimal(qty * price, 2);
    }

    const updated = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: updateData,
      include: { commodity: { include: { category: true, unit: true } } },
    });
    return this.serializeOrderItem(updated);
  }

  /**
   * 删除明细（软删除）
   * 同样双重定位（订单 + 明细），不存在 → 404
   * 只写 deletedAt，不影响订单本身
   */
  async deleteItem(orderId: string, itemId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!order)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, deletedAt: null },
    });
    if (!item)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });

    return { success: true, data: null };
  }

  /**
   * 金额舍入：保留 N 位小数（先乘再除，避免二进制浮点误差）
   * 例如 roundToDecimal(0.1 + 0.2, 2) = 0.3
   */
  private roundToDecimal(value: number, places: number): number {
    const factor = Math.pow(10, places);
    return Math.round(value * factor) / factor;
  }

  /**
   * 明细统一序列化：Prisma Decimal → number
   * 原因：Decimal 对象 JSON 序列化会变成 { s, e, d } 结构，
   * 前端拿不到纯数字。这里统一转 number，保证 create/update/findById 返回结构一致
   */
  private serializeOrderItem(item: any) {
    return {
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    };
  }
}
