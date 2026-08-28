import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

/**
 * ==================== SupermarketService（超市业务逻辑）====================
 *
 * 超市是进货后消费的超市（如端氏、嘉峰），独立无关联关系。
 * - 唯一性：name（超市名）唯一
 * - 删除：无引用关系，直接软删（无 IN_USE 检查）
 */
@Injectable()
export class SupermarketService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页 + keyword 搜索（name/备注） */
  async findAll(page: number, pageSize: number, keyword?: string, sortBy?: string, sortOrder?: string) {
    const where: Prisma.SupermarketWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.supermarket.findMany({ where, orderBy: sortBy ? ({ [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' } as Prisma.SupermarketOrderByWithRelationInput) : { createdAt: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.supermarket.count({ where }),
    ]);
    return { items, meta: { page, pageSize, total } };
  }

  /** 单个超市（未删除）；不存在 404 NOT_FOUND */
  async findById(id: string) {
    const record = await this.prisma.supermarket.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] } });
    return record;
  }

  /** 创建：name trim + 查重（409 SUPERMARKET_EXISTS）+ create */
  async create(data: { name: string; description?: string }) {
    const name = data.name.trim();
    const existing = await this.prisma.supermarket.findFirst({ where: { name, deletedAt: null } });
    if (existing) {
      throw new ConflictException({
        success: false,
        error: { code: ERROR_CODES.SUPERMARKET_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.SUPERMARKET_EXISTS], existingId: existing.id },
      });
    }
    return this.prisma.supermarket.create({ data: { name, description: data.description?.trim() || null } });
  }

  /** 更新：改名查重（排除自身） */
  async update(id: string, data: { name?: string; description?: string }) {
    await this.findById(id);
    const updateData: Prisma.SupermarketUpdateInput = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      const existing = await this.prisma.supermarket.findFirst({ where: { name, deletedAt: null, id: { not: id } } });
      if (existing) {
        throw new ConflictException({
          success: false,
          error: { code: ERROR_CODES.SUPERMARKET_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.SUPERMARKET_EXISTS], existingId: existing.id },
        });
      }
      updateData.name = name;
    }
    if (data.description !== undefined) updateData.description = data.description.trim() || null;
    return this.prisma.supermarket.update({ where: { id }, data: updateData });
  }

  /** 删除（软删除）：无引用关系，直接软删 */
  async delete(id: string) {
    await this.findById(id);
    await this.prisma.supermarket.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true, data: null };
  }
}
