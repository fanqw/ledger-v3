import { UnprocessableEntityException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrderService } from '../order.service';
import { orderItemUpdateSchema, orderItemCreateSchema } from '@ledger-v3/shared/validators';

describe('OrderService', () => {
  const prisma = {
    order: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    market: { findFirst: jest.fn() },
    orderItem: { count: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    commodity: { findFirst: jest.fn(), create: jest.fn() },
    category: { findFirst: jest.fn(), create: jest.fn() },
    unit: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new OrderService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(prisma));
  });

  // ==================== Order CRUD ====================

  it('返回分页订单列表并支持关键词搜索', async () => {
    prisma.order.findMany.mockResolvedValue([{
      id: 'order-1',
      market: null,
      items: [{ lineTotal: 100 }, { lineTotal: 50 }],
    }]);
    prisma.order.count.mockResolvedValue(1);
    await expect(service.findAll(2, 10, 'test')).resolves.toEqual({
      items: [{ id: 'order-1', market: null, totalAmount: 150 }],
      meta: { page: 2, pageSize: 10, total: 1 },
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10, where: expect.objectContaining({ OR: expect.any(Array) }) }),
    );
  });

  it('无关键词时分页查询不含 OR', async () => {
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);
    await service.findAll(1, 20);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
  });

  it('getNextName 返回时间戳格式 YYYYMMDDHHMMSS（对齐迁移数据）', async () => {
    const result = await service.getNextName();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    expect(result).toEqual({ name: `${y}${m}${d}${h}${min}${sec}` });
  });

  it('订单未找到时抛出 NotFoundException', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });

  it('返回含进货地和明细的订单详情', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      market: { id: 'pp-1' },
      items: [],
    });
    await expect(service.findById('order-1')).resolves.toMatchObject({ id: 'order-1' });
  });

  it('创建时名称重复抛出 ConflictException', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      service.create({ name: 'Dup', marketId: undefined, description: undefined }),
    ).rejects.toThrow(ConflictException);
  });

  it('创建时进货地不存在抛出 UnprocessableEntityException', async () => {
    prisma.order.findFirst.mockResolvedValueOnce(null);
    prisma.market.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ name: 'Ok', marketId: 'missing-pp', description: undefined }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('创建成功并 trim 名称', async () => {
    prisma.order.findFirst.mockResolvedValueOnce(null);
    prisma.market.findFirst.mockResolvedValue({ id: 'pp-1' });
    prisma.order.create.mockResolvedValue({ id: 'order-1' });
    await service.create({ name: '  Trim Me  ', marketId: 'pp-1', description: '  desc  ' });
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: { name: 'Trim Me', description: 'desc', marketId: 'pp-1' },
      include: { market: { include: { city: true } } },
    });
  });

  it('更新时名称重复（排除自身）抛出 ConflictException', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'order-1', items: [] });
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'existing' });
    await expect(service.update('order-1', { name: 'Dup' })).rejects.toThrow(ConflictException);
  });

  it('更新成功包含 relation connect', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'order-1', items: [] });
    prisma.order.findFirst.mockResolvedValueOnce(null); // 名称唯一性检查
    prisma.market.findFirst.mockResolvedValue({ id: 'pp-2', deletedAt: null }); // connect 前存在性校验
    prisma.order.update.mockResolvedValue({ id: 'order-1' });
    await service.update('order-1', { name: 'New', marketId: 'pp-2' });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { name: 'New', market: { connect: { id: 'pp-2' } } },
      include: { market: { include: { city: true } } },
    });
  });

  it('更新时显式清空市场（marketId=null → disconnect）', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'order-1', items: [] });
    prisma.order.findFirst.mockResolvedValueOnce(null);
    prisma.order.update.mockResolvedValue({ id: 'order-1' });
    await service.update('order-1', { name: 'New', marketId: null });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { name: 'New', market: { disconnect: true } },
      include: { market: { include: { city: true } } },
    });
    // disconnect 分支不应触发存在性校验
    expect(prisma.market.findFirst).not.toHaveBeenCalled();
  });

  it('更新时进货地不存在抛出 UnprocessableEntityException', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'order-1', items: [] });
    prisma.order.findFirst.mockResolvedValueOnce(null);
    prisma.market.findFirst.mockResolvedValue(null);
    await expect(
      service.update('order-1', { name: 'New', marketId: 'missing-pp' }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('更新时不传进货地则不修改（undefined）', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'order-1', items: [] });
    prisma.order.findFirst.mockResolvedValueOnce(null);
    prisma.order.update.mockResolvedValue({ id: 'order-1' });
    await service.update('order-1', { name: 'New' });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { name: 'New' },
      include: { market: { include: { city: true } } },
    });
  });

  it('软删除成功（无未删除明细）', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1', items: [] });
    prisma.orderItem.count.mockResolvedValue(0);
    prisma.order.update.mockResolvedValue({});
    await expect(service.delete('order-1')).resolves.toEqual({ success: true, data: null });
  });

  it('软删除被阻止（有未删除明细）', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1', items: [] });
    prisma.orderItem.count.mockResolvedValue(1);
    await expect(service.delete('order-1')).rejects.toThrow(ConflictException);
  });

  // ==================== OrderItem CRUD ====================

  it('添加明细（引用已有商品）lineTotal 按提交值原样持久化', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.commodity.findFirst.mockResolvedValue({ id: 'commodity-1' });
    prisma.orderItem.create.mockResolvedValue({ id: 'item-1' });
    await service.addItem('order-1', {
      commodityId: 'commodity-1',
      quantity: 2,
      unitPrice: 10.5,
      lineTotal: 15, // 用户手动修改后提交的值（不等于 2*10.5=21）
    });
    expect(prisma.orderItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ lineTotal: 15 }),
      include: expect.any(Object),
    });
  });

  it('添加明细时订单不存在抛出 NotFoundException', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(
      service.addItem('missing-order', { commodityId: 'commodity-1', quantity: 1, unitPrice: 5, lineTotal: 5 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('添加明细时商品不存在抛出 NotFoundException', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.commodity.findFirst.mockResolvedValue(null);
    await expect(
      service.addItem('order-1', { commodityId: 'missing', quantity: 1, unitPrice: 5, lineTotal: 5 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('即输即建逐条创建主数据+明细（使用独立 create 非 transaction）', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue({ id: 'cat-new' });
    prisma.unit.findFirst.mockResolvedValue(null);
    prisma.unit.create.mockResolvedValue({ id: 'unit-new' });
    prisma.commodity.findFirst.mockResolvedValue(null);
    prisma.commodity.create.mockResolvedValue({ id: 'commodity-new' });
    prisma.orderItem.create.mockResolvedValue({ id: 'item-1' });

    await service.addItem('order-1', {
      commodityName: '新品',
      categoryName: '新分类',
      unitName: '新单位',
      quantity: 3,
      unitPrice: 8,
      lineTotal: 24,
    });

    expect(prisma.category.create).toHaveBeenCalledWith({ data: { name: '新分类' } });
    expect(prisma.unit.create).toHaveBeenCalledWith({ data: { name: '新单位' } });
    expect(prisma.commodity.create).toHaveBeenCalledWith({
      data: { name: '新品', categoryId: 'cat-new', unitId: 'unit-new' },
    });
    expect(prisma.orderItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ commodityId: 'commodity-new', lineTotal: 24 }),
      include: expect.any(Object),
    });
  });

  it('即输即建复用已有分类和单位', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-existing' });
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-existing' });
    prisma.commodity.findFirst.mockResolvedValue({ id: 'commodity-existing' });
    prisma.orderItem.create.mockResolvedValue({ id: 'item-1' });

    await service.addItem('order-1', {
      commodityName: '已有商品',
      categoryId: 'cat-existing',
      unitId: 'unit-existing',
      quantity: 1,
      unitPrice: 5,
      lineTotal: 5,
    });

    expect(prisma.category.create).not.toHaveBeenCalled();
    expect(prisma.unit.create).not.toHaveBeenCalled();
    expect(prisma.commodity.create).not.toHaveBeenCalled();
    expect(prisma.orderItem.create).toHaveBeenCalled();
  });

  it('即输即建直传不存在的分类 id 时抛出 UnprocessableEntityException', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.category.findFirst.mockResolvedValue(null); // 分类不存在/已软删除
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-existing' });

    await expect(
      service.addItem('order-1', {
        commodityName: '新品',
        categoryId: 'missing-cat',
        unitId: 'unit-existing',
        quantity: 1,
        unitPrice: 5,
        lineTotal: 5,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.commodity.create).not.toHaveBeenCalled();
    expect(prisma.orderItem.create).not.toHaveBeenCalled();
  });

  it('即输即建直传不存在的单位 id 时抛出 UnprocessableEntityException', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-existing' });
    prisma.unit.findFirst.mockResolvedValue(null); // 单位不存在/已软删除

    await expect(
      service.addItem('order-1', {
        commodityName: '新品',
        categoryId: 'cat-existing',
        unitId: 'missing-unit',
        quantity: 1,
        unitPrice: 5,
        lineTotal: 5,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.commodity.create).not.toHaveBeenCalled();
    expect(prisma.orderItem.create).not.toHaveBeenCalled();
  });

  it('即输即建 category 创建失败时终止后续操作', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockRejectedValue(new Error('DB error'));

    await expect(
      service.addItem('order-1', {
        commodityName: '新品',
        categoryName: '新分类',
        unitName: '新单位',
        quantity: 1,
        unitPrice: 5,
        lineTotal: 5,
      }),
    ).rejects.toThrow('DB error');

    // 后续创建均未执行
    expect(prisma.unit.create).not.toHaveBeenCalled();
    expect(prisma.commodity.create).not.toHaveBeenCalled();
    expect(prisma.orderItem.create).not.toHaveBeenCalled();
  });

  it('即输即建缺少分类和单位时返回校验错误（不崩溃 500）', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });

    await expect(
      service.addItem('order-1', {
        commodityName: '无分类无单位商品',
        quantity: 1,
        unitPrice: 5,
        lineTotal: 5,
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    // 不应触发任何创建
    expect(prisma.category.findFirst).not.toHaveBeenCalled();
    expect(prisma.unit.findFirst).not.toHaveBeenCalled();
    expect(prisma.commodity.create).not.toHaveBeenCalled();
    expect(prisma.orderItem.create).not.toHaveBeenCalled();
  });

  it('即输即建缺少单位（有分类）时返回校验错误', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });

    await expect(
      service.addItem('order-1', {
        commodityName: '有分类无单位商品',
        categoryName: '新分类',
        quantity: 1,
        unitPrice: 5,
        lineTotal: 5,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('即输即建缺少分类（有单位）时返回校验错误', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });

    await expect(
      service.addItem('order-1', {
        commodityName: '有单位无分类商品',
        unitName: '新单位',
        quantity: 1,
        unitPrice: 5,
        lineTotal: 5,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('即输即建 OrderItem 创建失败时保留已创建的基础数据', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-existing' });
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-existing' });
    prisma.commodity.findFirst.mockResolvedValue({ id: 'commodity-existing' });
    prisma.orderItem.create.mockRejectedValue(new Error('OrderItem create failed'));

    // 基础数据已创建成功，OrderItem 失败不回滚
    await expect(
      service.addItem('order-1', {
        commodityName: '已有商品',
        categoryId: 'cat-existing',
        unitId: 'unit-existing',
        quantity: 1,
        unitPrice: 5,
        lineTotal: 5,
      }),
    ).rejects.toThrow('OrderItem create failed');

    // category/unit/commodity 没有被回滚（它们是已有的合法记录）
  });

  it('编辑明细（提供 lineTotal 则原样持久化）', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      quantity: { toNumber: () => 2, valueOf: () => 2 },
      unitPrice: { toNumber: () => 10, valueOf: () => 10 },
    });
    prisma.orderItem.update.mockResolvedValue({ id: 'item-1' });
    await service.updateItem('order-1', 'item-1', { lineTotal: 25 });
    expect(prisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { lineTotal: 25 },
      include: expect.any(Object),
    });
  });

  it('编辑明细（未提供 lineTotal 则重新计算）', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      quantity: { toNumber: () => 2, valueOf: () => 2 },
      unitPrice: { toNumber: () => 10, valueOf: () => 10 },
    });
    prisma.orderItem.update.mockResolvedValue({ id: 'item-1' });
    await service.updateItem('order-1', 'item-1', { quantity: 5 });
    expect(prisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 5, lineTotal: 50.0 },
      include: expect.any(Object),
    });
  });

  it('编辑明细时明细不存在抛出 NotFoundException', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.orderItem.findFirst.mockResolvedValue(null);
    await expect(service.updateItem('order-1', 'missing', { quantity: 1 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('软删除明细', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.orderItem.findFirst.mockResolvedValue({ id: 'item-1' });
    prisma.orderItem.update.mockResolvedValue({});
    await expect(service.deleteItem('order-1', 'item-1')).resolves.toEqual({
      success: true,
      data: null,
    });
    expect(prisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  // ==================== m1: Decimal 序列化 ====================

  it('addItem 返回时 Decimal 字段序列化为 number', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.commodity.findFirst.mockResolvedValue({ id: 'commodity-1', deletedAt: null });
    // Prisma 返回 Decimal（模拟对象）
    prisma.orderItem.create.mockResolvedValue({
      id: 'item-1',
      quantity: { toNumber: () => 2, valueOf: () => 2 },
      unitPrice: { toNumber: () => 5.5, valueOf: () => 5.5 },
      lineTotal: { toNumber: () => 11, valueOf: () => 11 },
    });

    const result = await service.addItem('order-1', {
      commodityId: 'commodity-1',
      quantity: 2,
      unitPrice: 5.5,
      lineTotal: 11,
    });
    expect(typeof result.quantity).toBe('number');
    expect(typeof result.unitPrice).toBe('number');
    expect(typeof result.lineTotal).toBe('number');
    expect(result.quantity).toBe(2);
    expect(result.lineTotal).toBe(11);
  });

  it('addItem 即输即建路径返回时 Decimal 序列化为 number', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-1' });
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' });
    prisma.commodity.findFirst.mockResolvedValue(null);
    prisma.commodity.create.mockResolvedValue({ id: 'commodity-new' });
    prisma.orderItem.create.mockResolvedValue({
      id: 'item-2',
      quantity: { toNumber: () => 3, valueOf: () => 3 },
      unitPrice: { toNumber: () => 8, valueOf: () => 8 },
      lineTotal: { toNumber: () => 24, valueOf: () => 24 },
    });

    const result = await service.addItem('order-1', {
      commodityName: '新品',
      categoryId: 'cat-1',
      unitId: 'unit-1',
      quantity: 3,
      unitPrice: 8,
      lineTotal: 24,
    });
    expect(typeof result.quantity).toBe('number');
    expect(typeof result.lineTotal).toBe('number');
  });

  it('updateItem 返回时 Decimal 字段序列化为 number', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      quantity: { toNumber: () => 2, valueOf: () => 2 },
      unitPrice: { toNumber: () => 10, valueOf: () => 10 },
      lineTotal: { toNumber: () => 20, valueOf: () => 20 },
    });
    prisma.orderItem.update.mockResolvedValue({
      id: 'item-1',
      quantity: { toNumber: () => 5, valueOf: () => 5 },
      unitPrice: { toNumber: () => 10, valueOf: () => 10 },
      lineTotal: { toNumber: () => 50, valueOf: () => 50 },
    });

    const result = await service.updateItem('order-1', 'item-1', { quantity: 5 });
    expect(typeof result.quantity).toBe('number');
    expect(typeof result.lineTotal).toBe('number');
    expect(result.quantity).toBe(5);
  });

  // ==================== m2/m3: 共享 schema refine ====================

  it('orderItemUpdateSchema 拒绝空 body', () => {
    const result = orderItemUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
    const ok = orderItemUpdateSchema.safeParse({ quantity: 2 });
    expect(ok.success).toBe(true);
  });

  it('orderItemCreateSchema 拒绝 commodityId 与 commodityName 同时提供', () => {
    const result = orderItemCreateSchema.safeParse({
      commodityId: 'c1',
      commodityName: '商品',
      quantity: 1,
      unitPrice: 5,
      lineTotal: 5,
    });
    expect(result.success).toBe(false);
    const ok = orderItemCreateSchema.safeParse({
      commodityName: '商品',
      categoryName: '分类',
      unitName: '单位',
      quantity: 1,
      unitPrice: 5,
      lineTotal: 5,
    });
    expect(ok.success).toBe(true);
  });
});
