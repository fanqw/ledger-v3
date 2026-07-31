import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class PurchasePlaceService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findById(id: string) {
    const record = await this.prisma.purchasePlace.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] } });
    return record;
  }

  async create(data: { place: string; marketName: string; description?: string }) {
    const place = data.place.trim();
    const marketName = data.marketName.trim();
    const existing = await this.prisma.purchasePlace.findFirst({ where: { place, marketName, deletedAt: null } });
    if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.PURCHASE_PLACE_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.PURCHASE_PLACE_EXISTS], existingId: existing.id } });
    return this.prisma.purchasePlace.create({ data: { place, marketName, description: data.description?.trim() || null } });
  }

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
