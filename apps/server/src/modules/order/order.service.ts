import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== Order CRUD ====================

  async getNextName() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await this.prisma.order.count({
      where: { deletedAt: null, createdAt: { gte: today } },
    });
    const seq = String(count + 1).padStart(2, '0');
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return { name: `${y}${m}${d}-${seq}` };
  }

  async findAll(page: number, pageSize: number, keyword?: string) {
    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { purchasePlace: { place: { contains: keyword, mode: 'insensitive' } } },
        { purchasePlace: { marketName: { contains: keyword, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { purchasePlace: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, meta: { page, pageSize, total } };
  }

  async findById(id: string) {
    const record = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: {
        purchasePlace: true,
        items: {
          where: { deletedAt: null },
          include: {
            commodity: {
              include: { category: true, unit: true },
            },
          },
          orderBy: [{ commodity: { category: { name: 'asc' } } }, { createdAt: 'asc' }],
        },
      },
    });
    if (!record)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    const items = (record.items || []).map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const lineTotal = Number(item.lineTotal);
      const computedLineTotal = this.roundToDecimal(quantity * unitPrice, 2);
      return {
        ...item,
        quantity,
        unitPrice,
        lineTotal,
        computedLineTotal,
        isModified: Math.abs(lineTotal - computedLineTotal) > 0.005,
        commodity: item.commodity
          ? { ...item.commodity, category: item.commodity.category || undefined, unit: item.commodity.unit || undefined }
          : undefined,
      };
    });

    return { ...record, items };
  }

  async create(data: { name: string; purchasePlaceId?: string; description?: string }) {
    const name = data.name.trim();

    if (data.purchasePlaceId) {
      const pp = await this.prisma.purchasePlace.findFirst({
        where: { id: data.purchasePlaceId, deletedAt: null },
      });
      if (!pp)
        throw new BadRequestException({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR] },
        });
    }

    const existing = await this.prisma.order.findFirst({
      where: { name, deletedAt: null },
    });
    if (existing)
      throw new ConflictException({
        success: false,
        error: { code: ERROR_CODES.ORDER_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.ORDER_EXISTS], existingId: existing.id },
      });

    return this.prisma.order.create({
      data: { name, description: data.description?.trim() || null, purchasePlaceId: data.purchasePlaceId || null },
      include: { purchasePlace: true },
    });
  }

  async update(id: string, data: { name?: string; description?: string; purchasePlaceId?: string }) {
    await this.findById(id);
    const updateData: Prisma.OrderUpdateInput = {};

    if (data.name !== undefined) {
      const name = data.name.trim();
      const existing = await this.prisma.order.findFirst({
        where: { name, deletedAt: null, id: { not: id } },
      });
      if (existing)
        throw new ConflictException({
          success: false,
          error: { code: ERROR_CODES.ORDER_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.ORDER_EXISTS], existingId: existing.id },
        });
      updateData.name = name;
    }
    if (data.description !== undefined) updateData.description = data.description.trim() || null;
    if (data.purchasePlaceId !== undefined) {
      updateData.purchasePlace = data.purchasePlaceId
        ? { connect: { id: data.purchasePlaceId } }
        : { disconnect: true };
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData,
      include: { purchasePlace: true },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.orderItem.count({ where: { orderId: id, deletedAt: null } });
      if (linked > 0)
        throw new ConflictException({
          success: false,
          error: { code: ERROR_CODES.ORDER_HAS_ITEMS, message: ERROR_MESSAGES[ERROR_CODES.ORDER_HAS_ITEMS] },
        });
      await tx.order.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true, data: null };
    });
  }

  // ==================== OrderItem CRUD ====================

  async addItem(
    orderId: string,
    data: {
      commodityId?: string;
      commodityName?: string;
      categoryId?: string;
      categoryName?: string;
      unitId?: string;
      unitName?: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      description?: string;
    },
  ) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!order)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    // Path A: existing commodity
    if (data.commodityId) {
      const commodity = await this.prisma.commodity.findFirst({
        where: { id: data.commodityId, deletedAt: null },
      });
      if (!commodity)
        throw new NotFoundException({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
        });

      return this.prisma.orderItem.create({
        data: {
          orderId,
          commodityId: data.commodityId,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          lineTotal: data.lineTotal,
          description: data.description?.trim() || null,
        },
        include: { commodity: { include: { category: true, unit: true } } },
      });
    }

    // Path B: quick-create (sequential — master data NOT rolled back on OrderItem failure)
    // 业务约束：即输即建商品时必须同时提供分类和单位（与商品基础资料页一致），
    // 否则 Prisma 必填关系缺失会导致 500，这里显式转为 422 校验错误。
    if (!data.categoryId && !data.categoryName) {
      throw new BadRequestException({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: '即输即建商品时必须选择分类' },
      });
    }
    if (!data.unitId && !data.unitName) {
      throw new BadRequestException({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: '即输即建商品时必须选择单位' },
      });
    }

    let categoryId: string | undefined = data.categoryId;
    if (!categoryId && data.categoryName) {
      const catName = data.categoryName.trim();
      let cat = await this.prisma.category.findFirst({ where: { name: catName, deletedAt: null } });
      if (!cat) {
        cat = await this.prisma.category.create({ data: { name: catName } });
      }
      categoryId = cat.id;
    }

    let unitId: string | undefined = data.unitId;
    if (!unitId && data.unitName) {
      const unitName = data.unitName.trim();
      let unit = await this.prisma.unit.findFirst({ where: { name: unitName, deletedAt: null } });
      if (!unit) {
        unit = await this.prisma.unit.create({ data: { name: unitName } });
      }
      unitId = unit.id;
    }

    const commodityName = data.commodityName!.trim();
    let commodity = await this.prisma.commodity.findFirst({
      where: { name: commodityName, unitId: unitId!, deletedAt: null },
    });
    if (!commodity) {
      commodity = await this.prisma.commodity.create({
        data: { name: commodityName, categoryId: categoryId!, unitId: unitId! },
      });
    }

    return this.prisma.orderItem.create({
      data: {
        orderId,
        commodityId: commodity.id,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        lineTotal: data.lineTotal,
        description: data.description?.trim() || null,
      },
      include: { commodity: { include: { category: true, unit: true } } },
    });
  }

  async updateItem(
    orderId: string,
    itemId: string,
    data: { quantity?: number; unitPrice?: number; lineTotal?: number; description?: string },
  ) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!order)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, deletedAt: null },
    });
    if (!item)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    const updateData: Prisma.OrderItemUpdateInput = {};

    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice;
    if (data.description !== undefined) updateData.description = data.description.trim() || null;

    if (data.lineTotal !== undefined) {
      updateData.lineTotal = data.lineTotal;
    } else if (data.quantity !== undefined || data.unitPrice !== undefined) {
      const qty = data.quantity !== undefined ? data.quantity : Number(item.quantity);
      const price = data.unitPrice !== undefined ? data.unitPrice : Number(item.unitPrice);
      updateData.lineTotal = this.roundToDecimal(qty * price, 2);
    }

    return this.prisma.orderItem.update({
      where: { id: itemId },
      data: updateData,
      include: { commodity: { include: { category: true, unit: true } } },
    });
  }

  async deleteItem(orderId: string, itemId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!order)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, deletedAt: null },
    });
    if (!item)
      throw new NotFoundException({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] },
      });

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });

    return { success: true, data: null };
  }

  private roundToDecimal(value: number, places: number): number {
    const factor = Math.pow(10, places);
    return Math.round(value * factor) / factor;
  }
}
