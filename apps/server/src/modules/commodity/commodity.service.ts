import { Injectable, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class CommodityService {
  constructor(private readonly prisma: PrismaService) {}

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
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: true, unit: true },
      }),
      this.prisma.commodity.count({ where }),
    ]);
    return { items, meta: { page, pageSize, total } };
  }

  async findById(id: string) {
    const record = await this.prisma.commodity.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, unit: true },
    });
    if (!record) throw new NotFoundException({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] } });
    return record;
  }

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
