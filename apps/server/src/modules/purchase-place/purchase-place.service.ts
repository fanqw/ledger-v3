import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

/**
 * ==================== PurchasePlaceService（进货地=城市业务逻辑）====================
 *
 * 进货地现在表示「城市」（如晋城、郑州）。唯一性：place（城市名）唯一。
 * - 创建：place trim 后按 place 查重
 * - 更新：改 place 时按 place 查重（排除自身）
 * - 删除：被市场（Market.cityId）引用禁止删除 → PURCHASE_PLACE_IN_USE
 */
@Injectable()
export class PurchasePlaceService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页 + keyword 搜索（place/备注） */
  async findAll(page: number, pageSize: number, keyword?: string, sortBy?: string, sortOrder?: string) {
    const where: Prisma.PurchasePlaceWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { place: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.purchasePlace.findMany({ where, orderBy: sortBy ? ({ [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' } as Prisma.PurchasePlaceOrderByWithRelationInput) : { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
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

  /** 创建：place trim + 按 place 查重（重复 409）+ create */
  async create(data: { place: string; description?: string }) {
    const place = data.place.trim();
    const existing = await this.prisma.purchasePlace.findFirst({ where: { place, deletedAt: null } });
    if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.PURCHASE_PLACE_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.PURCHASE_PLACE_EXISTS], existingId: existing.id } });
    return this.prisma.purchasePlace.create({ data: { place, description: data.description?.trim() || null } });
  }

  /** 更新：改 place 时按 place 查重（排除自身） */
  async update(id: string, data: { place?: string; description?: string }) {
    await this.findById(id);
    const updateData: Prisma.PurchasePlaceUpdateInput = {};
    if (data.place !== undefined) {
      const place = data.place.trim();
      const existing = await this.prisma.purchasePlace.findFirst({ where: { place, deletedAt: null, id: { not: id } } });
      if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.PURCHASE_PLACE_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.PURCHASE_PLACE_EXISTS], existingId: existing.id } });
      updateData.place = place;
    }
    if (data.description !== undefined) updateData.description = data.description.trim() || null;
    return this.prisma.purchasePlace.update({ where: { id }, data: updateData });
  }

  /** 删除（软删除 + 引用检查）：被市场引用禁止删除；$transaction 原子性 */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.market.count({ where: { cityId: id, deletedAt: null } });
      if (linked > 0) throw new ConflictException({ success: false, error: { code: ERROR_CODES.PURCHASE_PLACE_IN_USE, message: ERROR_MESSAGES[ERROR_CODES.PURCHASE_PLACE_IN_USE] } });
      await tx.purchasePlace.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true, data: null };
    });
  }
}
