import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

/**
 * ==================== UnitService（单位业务逻辑）====================
 *
 * 与 CategoryService 同模板，讲解见 category.service.ts。通用约定：
 * - 所有查询带 deletedAt: null（软删除不可见）
 * - 业务错误用 NestJS 异常类抛出（404 / 409），带统一 error 结构
 *
 * 单位特有差异：被「商品」引用（unitId）时禁止删除 → UNIT_IN_USE
 */
@Injectable()
export class UnitService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 分页 + keyword 搜索（name/description，不区分大小写）
   * Promise.all 并行查 findMany + count；skip/take 实现分页
   */
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

  /** 单个单位（未删除）；不存在 → 404 NOT_FOUND */
  async findById(id: string) {
    const record = await this.prisma.unit.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] } });
    return record;
  }

  /** 创建：name.trim() + 查重（重复 409 UNIT_EXISTS）+ create */
  async create(data: { name: string; description?: string }) {
    const name = data.name.trim();
    const existing = await this.prisma.unit.findFirst({ where: { name, deletedAt: null } });
    if (existing) throw new ConflictException({ success: false, error: { code: ERROR_CODES.UNIT_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.UNIT_EXISTS], existingId: existing.id } });
    return this.prisma.unit.create({ data: { name, description: data.description?.trim() || null } });
  }

  /** 更新：改名查重排除自身（id: { not }）；只更新传进来的字段 */
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

  /**
   * 删除（软删除 + 引用检查）
   * $transaction：count 商品引用 → 有引用抛 409 UNIT_IN_USE → 写 deletedAt
   */
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
