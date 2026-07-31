import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class UnitService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page: number, pageSize: number, keyword?: string) {
    const where: Prisma.UnitWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.unit.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.unit.count({ where }),
    ]);
    return { items, meta: { page, pageSize, total } };
  }

  async findById(id: string) {
    const record = await this.prisma.unit.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] } });
    return record;
  }

  async create(data: { name: string; description?: string }) {
    const name = data.name.trim();
    const existing = await this.prisma.unit.findFirst({ where: { name, deletedAt: null } });
    if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.UNIT_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.UNIT_EXISTS], existingId: existing.id } });
    return this.prisma.unit.create({ data: { name, description: data.description?.trim() || null } });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    await this.findById(id);
    const updateData: Prisma.UnitUpdateInput = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      const existing = await this.prisma.unit.findFirst({ where: { name, deletedAt: null, id: { not: id } } });
      if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.UNIT_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.UNIT_EXISTS], existingId: existing.id } });
      updateData.name = name;
    }
    if (data.description !== undefined) updateData.description = data.description.trim() || null;
    return this.prisma.unit.update({ where: { id }, data: updateData });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.commodity.count({ where: { unitId: id, deletedAt: null } });
      if (linked > 0) throw new ConflictException({ success: false, error: { code: ERROR_CODES.UNIT_IN_USE, message: ERROR_MESSAGES[ERROR_CODES.UNIT_IN_USE] } });
      await tx.unit.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true, data: null };
    });
  }
}
