import { Injectable, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

/**
 * ==================== CommodityService（商品业务逻辑）====================
 *
 * 在 category/unit 的 CRUD 模板之上，商品多了两块业务：外键校验 + 关系查询。
 *
 * 关键概念（Prisma 关系）：
 * - Commodity 表有 categoryId / unitId 两个外键，指向 Category / Unit
 * - 创建时若不校验外键存在，Prisma 会因数据库外键约束抛 500 ——
 *   所以这里先 findFirst 校验，不存在则转成 422 VALIDATION_ERROR（业务语义更清晰）
 * - 查询用 include: { category, unit } 联表取关联对象
 * - 唯一性 = 「名称 + 单位」组合：同名但单位不同的两个商品是允许的
 */
@Injectable()
export class CommodityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 分页列表 + 搜索
   * 学习点：where.OR 里除了商品自身字段，还能用关系字段搜索：
   *   { category: { name: { contains } } } —— 搜「分类名」
   *   { unit: { name: { contains } } }     —— 搜「单位名」
   * findMany include category+unit，count 不带 include（计数不需要关联）
   */
  async findAll(page: number, pageSize: number, keyword?: string) {
    const where: Prisma.CommodityWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { category: { name: { contains: keyword, mode: 'insensitive' } } },
        { unit: { name: { contains: keyword, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.commodity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: true, unit: true },
      }),
      this.prisma.commodity.count({ where }),
    ]);
    return { items, meta: { page, pageSize, total } };
  }

  /** 单个商品（含分类/单位）；不存在 404 NOT_FOUND */
  async findById(id: string) {
    const record = await this.prisma.commodity.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, unit: true },
    });
    if (!record) throw new NotFoundException({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] } });
    return record;
  }

  /**
   * 创建商品
   * 校验顺序：
   *   1. 外键存在性：Promise.all 并行查 category + unit（都需未删除）
   *      → 任一缺失抛 422 VALIDATION_ERROR
   *   2. 唯一性：「name + unitId」组合查重 → 重复抛 409 COMMODITY_EXISTS
   *   3. create + include（返回带关联对象）
   */
  async create(data: { name: string; description?: string; categoryId: string; unitId: string }) {
    const name = data.name.trim();
    // Check FK existence
    const [category, unit] = await Promise.all([
      this.prisma.category.findFirst({ where: { id: data.categoryId, deletedAt: null } }),
      this.prisma.unit.findFirst({ where: { id: data.unitId, deletedAt: null } }),
    ]);
    if (!category || !unit) throw new UnprocessableEntityException({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR] } });

    // Check uniqueness
    const existing = await this.prisma.commodity.findFirst({ where: { name, unitId: data.unitId, deletedAt: null } });
    if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.COMMODITY_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.COMMODITY_EXISTS], existingId: existing.id } });

    return this.prisma.commodity.create({
      data: { name, description: data.description?.trim() || null, categoryId: data.categoryId, unitId: data.unitId },
      include: { category: true, unit: true },
    });
  }

  /**
   * 更新商品
   * 学习点：
   * - 先 findById(id)（含 404 检查），保留 existingRecord 用于查重时的「现单位」
   * - 改名查重用「新名 + 单位」组合：data.unitId ?? existingRecord.unitId
   *   （不改单位时用当前单位做组合判断）
   * - 关系字段用 { connect: { id } } —— Prisma 关系更新语法（连接而非赋值外键）
   */
  async update(id: string, data: { name?: string; description?: string; categoryId?: string; unitId?: string }) {
    const existingRecord = await this.findById(id);
    const updateData: Prisma.CommodityUpdateInput = {};

    if (data.name !== undefined) {
      const name = data.name.trim();
      const unitId = data.unitId || existingRecord.unitId;
      const existing = await this.prisma.commodity.findFirst({ where: { name, unitId, deletedAt: null, id: { not: id } } });
      if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.COMMODITY_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.COMMODITY_EXISTS], existingId: existing.id } });
      updateData.name = name;
    }
    if (data.description !== undefined) updateData.description = data.description.trim() || null;
    if (data.categoryId) updateData.category = { connect: { id: data.categoryId } };
    if (data.unitId) updateData.unit = { connect: { id: data.unitId } };

    return this.prisma.commodity.update({ where: { id }, data: updateData, include: { category: true, unit: true } });
  }

  /**
   * 删除商品（软删除 + 引用检查）
   * 被订单明细（orderItem）引用 → 409 COMMODITY_IN_USE，禁止删除
   * $transaction 保证「检查 + 软删」原子性
   */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.orderItem.count({ where: { commodityId: id, deletedAt: null } });
      if (linked > 0) throw new ConflictException({ success: false, error: { code: ERROR_CODES.COMMODITY_IN_USE, message: ERROR_MESSAGES[ERROR_CODES.COMMODITY_IN_USE] } });
      await tx.commodity.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true, data: null };
    });
  }
}
