import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

/**
 * ==================== CategoryService（分类业务逻辑）====================
 *
 * 职责：分类 CRUD 的数据访问与业务规则。是其他基础资料 service 的参考模板。
 *
 * 贯穿全部 service 的约定：
 * - 所有查询都带 deletedAt: null —— 软删除的记录一律「看不见」（统一过滤）
 * - 业务错误用 NestJS 异常类抛出（ConflictException=409 / NotFoundException=404），
 *   异常对象里带 { success: false, error: { code, message } } 统一格式
 * - 错误码来自 @ledger-v3/shared/constants 的 ERROR_CODES（前后端共享）
 */
@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 分页列表 + 关键词搜索
   * 学习点：
   * - Prisma where 构建：deletedAt: null 固定 + keyword 时追加 OR
   *   （mode: 'insensitive' → 数据库 LIKE 不区分大小写）
   * - Promise.all 并行执行 findMany + count（两个独立查询同时发出，比串行快）
   * - 分页公式：skip = (page-1)*pageSize（跳过前 N 条），take = pageSize（取 N 条）
   * - orderBy createdAt asc：插入顺序（对齐 V1 无显式排序的 _id 升序）
   * - 返回 { items, meta: { page, pageSize, total } } 是项目统一分页协议
   */
  async findAll(page: number, pageSize: number, keyword?: string) {
    const where: Prisma.CategoryWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.category.count({ where }),
    ]);

    return { items, meta: { page, pageSize, total } };
  }

  /**
   * 按 id 查单个分类（只查未删除）
   * 找不到 → 抛 404 NOT_FOUND（统一格式）
   */
  async findById(id: string) {
    const record = await this.prisma.category.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] } });
    return record;
  }

  /**
   * 创建分类
   * 学习点：
   * - name.trim()：入库前去掉首尾空白（前端没 trim 的兜底）
   * - 先查同名未删除记录 → 存在抛 409 CATEGORY_EXISTS（带 existingId 方便前端定位）
   * - description 空字符串 → null（保持数据干净，不存空串）
   */
  async create(data: { name: string; description?: string }) {
    const name = data.name.trim();
    const existing = await this.prisma.category.findFirst({ where: { name, deletedAt: null } });
    if (existing) {
      throw new ConflictException({
        success: false,
        error: { code: ERROR_CODES.CATEGORY_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.CATEGORY_EXISTS], existingId: existing.id },
      });
    }
    return this.prisma.category.create({ data: { name, description: data.description?.trim() || null } });
  }

  /**
   * 更新分类（部分更新）
   * 学习点：
   * - 先 findById(id) → 不存在直接 404（统一入口）
   * - 改名时唯一校验用 id: { not: id } 排除自身（否则「改自己名字」会误判重复）
   * - 用 Prisma.CategoryUpdateInput 动态拼 updateData：只更新传进来的字段
   */
  async update(id: string, data: { name?: string; description?: string }) {
    await this.findById(id);
    const updateData: Prisma.CategoryUpdateInput = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      const existing = await this.prisma.category.findFirst({ where: { name, deletedAt: null, id: { not: id } } });
      if (existing) {
        throw new ConflictException({
          success: false,
          error: { code: ERROR_CODES.CATEGORY_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.CATEGORY_EXISTS], existingId: existing.id },
        });
      }
      updateData.name = name;
    }
    if (data.description !== undefined) updateData.description = data.description.trim() || null;
    return this.prisma.category.update({ where: { id }, data: updateData });
  }

  /**
   * 删除分类（软删除 + 引用检查）
   * 学习点：
   * - $transaction：把「检查引用 + 写 deletedAt」放进同一事务 —— 要么都成功要么都回滚，
   *   避免「检查通过但删除失败」的中间态
   * - 被商品引用的分类（count > 0）→ 409 CATEGORY_IN_USE，禁止删除
   * - 软删除 = update deletedAt = 当前时间，而非 delete（数据保留可恢复）
   * - 事务内的异常（throw ConflictException）会触发整个事务回滚
   */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.commodity.count({ where: { categoryId: id, deletedAt: null } });
      if (linked > 0) {
        throw new ConflictException({
          success: false,
          error: { code: ERROR_CODES.CATEGORY_IN_USE, message: ERROR_MESSAGES[ERROR_CODES.CATEGORY_IN_USE] },
        });
      }
      await tx.category.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true, data: null };
    });
  }
}
