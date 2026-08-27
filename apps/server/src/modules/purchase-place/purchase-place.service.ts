import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

/**
 * ==================== PurchasePlaceService（进货地业务逻辑）====================
 *
 * 与 category/unit 同模板，差异点：唯一性校验基于「place + marketName」组合。
 *
 * 学习重点（组合唯一）：
 * - 创建：两字段都 trim 后按组合查重
 * - 更新：只改 place 时，marketName 用现值（data.marketName ?? existingRecord.marketName）
 *   参与组合查重 —— 否则会漏判「改了 place 但 marketName 没变」的重复场景
 * - 删除：被订单引用（purchasePlaceId）禁止删除 → PURCHASE_PLACE_IN_USE
 */
@Injectable()
export class PurchasePlaceService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页 + keyword 搜索（place/marketName/备注） */
  async findAll(page: number, pageSize: number, keyword?: string) {
    const where: Prisma.PurchasePlaceWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { place: { contains: keyword, mode: 'insensitive' } },
        { marketName: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.purchasePlace.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.purchasePlace.count({ where }),
    ]);
    return { items, meta: { page, pageSize, total } };
  }

  /** 单个进货地（未删除）；不存在 404 NOT_FOUND */
  async findById(id: string) {
    const record = await this.prisma.purchasePlace.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] } });
    return record;
  }

  /** 创建：两字段 trim + 按组合查重（重复 409）+ create */
  async create(data: { place: string; marketName: string; description?: string }) {
    const place = data.place.trim();
    const marketName = data.marketName.trim();
    const existing = await this.prisma.purchasePlace.findFirst({ where: { place, marketName, deletedAt: null } });
    if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.PURCHASE_PLACE_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.PURCHASE_PLACE_EXISTS], existingId: existing.id } });
    return this.prisma.purchasePlace.create({ data: { place, marketName, description: data.description?.trim() || null } });
  }

  /**
   * 更新：place / marketName 各自变更时，都用「新值 + 另一字段现值」做组合查重
   * （体现组合唯一的核心：单独更新任一字段都不能造成组合重复）
   */
  async update(id: string, data: { place?: string; marketName?: string; description?: string }) {
    const existingRecord = await this.findById(id);
    const updateData: Prisma.PurchasePlaceUpdateInput = {};

    if (data.place !== undefined) {
      const place = data.place.trim();
      const marketName = data.marketName?.trim() || existingRecord.marketName;
      const existing = await this.prisma.purchasePlace.findFirst({ where: { place, marketName, deletedAt: null, id: { not: id } } });
      if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.PURCHASE_PLACE_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.PURCHASE_PLACE_EXISTS], existingId: existing.id } });
      updateData.place = place;
    }
    if (data.marketName !== undefined) {
      const marketName = data.marketName.trim();
      const place = data.place?.trim() || existingRecord.place;
      const existing = await this.prisma.purchasePlace.findFirst({ where: { place, marketName, deletedAt: null, id: { not: id } } });
      if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.PURCHASE_PLACE_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.PURCHASE_PLACE_EXISTS], existingId: existing.id } });
      updateData.marketName = marketName;
    }
    if (data.description !== undefined) updateData.description = data.description.trim() || null;
    return this.prisma.purchasePlace.update({ where: { id }, data: updateData });
  }

  /** 删除（软删除 + 引用检查）：被订单引用禁止删除；$transaction 原子性 */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.order.count({ where: { purchasePlaceId: id, deletedAt: null } });
      if (linked > 0) throw new ConflictException({ success: false, error: { code: ERROR_CODES.PURCHASE_PLACE_IN_USE, message: ERROR_MESSAGES[ERROR_CODES.PURCHASE_PLACE_IN_USE] } });
      await tx.purchasePlace.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true, data: null };
    });
  }
}
