import { Injectable, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

/**
 * ==================== MarketService（市场业务逻辑）====================
 *
 * 市场是城市中的批发市场（如长治市场），关联进货地城市（cityId）。
 * - 唯一性：name（市场名）唯一
 * - 创建/改城市：校验 cityId 指向未删除城市，否则 422 VALIDATION_ERROR
 * - 删除：被订单引用（Order.marketId）禁止删除 → MARKET_IN_USE
 */
@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页 + keyword 搜索（name/关联城市 place/备注），include 所属城市 */
  async findAll(page: number, pageSize: number, keyword?: string, sortBy?: string, sortOrder?: string) {
    const where: Prisma.MarketWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { city: { place: { contains: keyword, mode: 'insensitive' } } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.market.findMany({
        where,
        include: { city: true },
        orderBy: sortBy ? ({ [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' } as Prisma.MarketOrderByWithRelationInput) : { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.market.count({ where }),
    ]);
    return { items, meta: { page, pageSize, total } };
  }

  /** 单个市场（未删除，含城市）；不存在 404 NOT_FOUND */
  async findById(id: string) {
    const record = await this.prisma.market.findFirst({ where: { id, deletedAt: null }, include: { city: true } });
    if (!record) throw new NotFoundException({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] } });
    return record;
  }

  /** 创建：城市存在校验 → name 查重（409 MARKET_EXISTS）→ create（include 城市） */
  async create(data: { name: string; cityId: string; description?: string }) {
    const name = data.name.trim();
    await this.ensureCityExists(data.cityId);
    const existing = await this.prisma.market.findFirst({ where: { name, deletedAt: null } });
    if (existing) {
      throw new ConflictException({
        success: false,
        error: { code: ERROR_CODES.MARKET_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.MARKET_EXISTS], existingId: existing.id },
      });
    }
    return this.prisma.market.create({
      data: { name, cityId: data.cityId, description: data.description?.trim() || null },
      include: { city: true },
    });
  }

  /** 更新：改名查重（排除自身）；改城市先校验存在 */
  async update(id: string, data: { name?: string; cityId?: string; description?: string }) {
    await this.findById(id);
    const updateData: Prisma.MarketUpdateInput = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      const existing = await this.prisma.market.findFirst({ where: { name, deletedAt: null, id: { not: id } } });
      if (existing) {
        throw new ConflictException({
          success: false,
          error: { code: ERROR_CODES.MARKET_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.MARKET_EXISTS], existingId: existing.id },
        });
      }
      updateData.name = name;
    }
    if (data.cityId !== undefined) {
      await this.ensureCityExists(data.cityId);
      updateData.city = { connect: { id: data.cityId } };
    }
    if (data.description !== undefined) updateData.description = data.description.trim() || null;
    return this.prisma.market.update({ where: { id }, data: updateData, include: { city: true } });
  }

  /** 删除（软删除 + 引用检查）：被订单引用禁止删除；$transaction 原子性 */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.order.count({ where: { marketId: id, deletedAt: null } });
      if (linked > 0) {
        throw new ConflictException({
          success: false,
          error: { code: ERROR_CODES.MARKET_IN_USE, message: ERROR_MESSAGES[ERROR_CODES.MARKET_IN_USE] },
        });
      }
      await tx.market.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true, data: null };
    });
  }

  /** 校验城市存在且未删除；不存在 422 VALIDATION_ERROR */
  private async ensureCityExists(cityId: string) {
    const city = await this.prisma.purchasePlace.findFirst({ where: { id: cityId, deletedAt: null } });
    if (!city) {
      throw new UnprocessableEntityException({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR] },
      });
    }
  }
}
