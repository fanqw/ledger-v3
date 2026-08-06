import { UnprocessableEntityException, ConflictException, NotFoundException } from '@nestjs/common';
import { CommodityService } from '../commodity.service';

describe('CommodityService', () => {
  const prisma = {
    commodity: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    category: { findFirst: jest.fn() },
    unit: { findFirst: jest.fn() },
    orderItem: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new CommodityService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it('returns commodities filtered by keyword', async () => {
    prisma.commodity.findMany.mockResolvedValue([{ id: 'commodity-1' }]);
    prisma.commodity.count.mockResolvedValue(1);
    await expect(service.findAll(2, 10, 'rice')).resolves.toEqual({ items: [{ id: 'commodity-1' }], meta: { page: 2, pageSize: 10, total: 1 } });
    expect(prisma.commodity.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, where: expect.objectContaining({ OR: expect.any(Array) }) }));
  });

  it('throws when a commodity is missing', async () => {
    prisma.commodity.findFirst.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });

  it('rejects create when a foreign key is missing', async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' });
    await expect(service.create({ name: 'Rice', categoryId: 'missing', unitId: 'unit-1' })).rejects.toThrow(UnprocessableEntityException);
  });

  it('creates a unique commodity with valid relations', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'category-1' });
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' });
    prisma.commodity.findFirst.mockResolvedValue(null);
    prisma.commodity.create.mockResolvedValue({ id: 'commodity-1' });
    await service.create({ name: ' Rice ', description: ' Grain ', categoryId: 'category-1', unitId: 'unit-1' });
    expect(prisma.commodity.create).toHaveBeenCalledWith({ data: { name: 'Rice', description: 'Grain', categoryId: 'category-1', unitId: 'unit-1' }, include: { category: true, unit: true } });
  });

  it('rejects a duplicate commodity on create', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'category-1' });
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' });
    prisma.commodity.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create({ name: 'Rice', categoryId: 'category-1', unitId: 'unit-1' })).rejects.toThrow(ConflictException);
  });

  it('updates fields and relation connections', async () => {
    prisma.commodity.findFirst.mockResolvedValueOnce({ id: 'commodity-1', unitId: 'unit-old' }).mockResolvedValueOnce(null);
    prisma.commodity.update.mockResolvedValue({ id: 'commodity-1' });
    await service.update('commodity-1', { name: ' Rice ', description: ' ', categoryId: 'category-2', unitId: 'unit-2' });
    expect(prisma.commodity.update).toHaveBeenCalledWith({
      where: { id: 'commodity-1' },
      data: { name: 'Rice', description: null, category: { connect: { id: 'category-2' } }, unit: { connect: { id: 'unit-2' } } },
      include: { category: true, unit: true },
    });
  });

  it('rejects a duplicate commodity on update', async () => {
    prisma.commodity.findFirst.mockResolvedValueOnce({ id: 'commodity-1', unitId: 'unit-1' }).mockResolvedValueOnce({ id: 'existing' });
    await expect(service.update('commodity-1', { name: 'Rice' })).rejects.toThrow(ConflictException);
  });

  it('soft deletes a commodity with no linked order items', async () => {
    prisma.commodity.findFirst.mockResolvedValue({ id: 'commodity-1' });
    prisma.orderItem.count.mockResolvedValue(0);
    prisma.commodity.update.mockResolvedValue({});
    await expect(service.delete('commodity-1')).resolves.toEqual({ success: true, data: null });
    expect(prisma.commodity.update).toHaveBeenCalledWith({ where: { id: 'commodity-1' }, data: { deletedAt: expect.any(Date) } });
  });

  it('rejects deleting a commodity used by order items', async () => {
    prisma.commodity.findFirst.mockResolvedValue({ id: 'commodity-1' });
    prisma.orderItem.count.mockResolvedValue(1);
    await expect(service.delete('commodity-1')).rejects.toThrow(ConflictException);
  });
});
