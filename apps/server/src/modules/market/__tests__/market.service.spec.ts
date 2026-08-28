import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { MarketService } from '../market.service';

describe('MarketService', () => {
  const prisma = {
    market: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    purchasePlace: { findFirst: jest.fn() },
    order: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new MarketService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it('returns markets filtered by keyword with city included', async () => {
    prisma.market.findMany.mockResolvedValue([{ id: 'market-1', city: { id: 'city-1' } }]);
    prisma.market.count.mockResolvedValue(1);
    await expect(service.findAll(1, 10, '长治')).resolves.toEqual({
      items: [{ id: 'market-1', city: { id: 'city-1' } }],
      meta: { page: 1, pageSize: 10, total: 1 },
    });
    expect(prisma.market.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { city: true },
      skip: 0,
      take: 10,
    }));
  });

  it('throws when the market is missing', async () => {
    prisma.market.findFirst.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });

  it('creates a market with trimmed name and included city', async () => {
    prisma.purchasePlace.findFirst.mockResolvedValue({ id: 'city-1' });
    prisma.market.findFirst.mockResolvedValue(null);
    prisma.market.create.mockResolvedValue({ id: 'market-1', city: { id: 'city-1' } });
    await service.create({ name: ' 长治市场 ', cityId: 'city-1', description: ' 主产区 ' });
    expect(prisma.market.create).toHaveBeenCalledWith({
      data: { name: '长治市场', cityId: 'city-1', description: '主产区' },
      include: { city: true },
    });
  });

  it('rejects a duplicate market name on create', async () => {
    prisma.purchasePlace.findFirst.mockResolvedValue({ id: 'city-1' });
    prisma.market.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create({ name: '长治市场', cityId: 'city-1' })).rejects.toThrow(ConflictException);
  });

  it('rejects creating a market with a missing city', async () => {
    prisma.purchasePlace.findFirst.mockResolvedValue(null);
    await expect(service.create({ name: '长治市场', cityId: 'missing' })).rejects.toThrow(UnprocessableEntityException);
  });

  it('updates name and city', async () => {
    prisma.market.findFirst
      .mockResolvedValueOnce({ id: 'market-1', name: 'Old', cityId: 'city-1' }) // findById
      .mockResolvedValueOnce(null); // name 查重
    prisma.purchasePlace.findFirst.mockResolvedValue({ id: 'city-2' }); // 城市校验
    prisma.market.update.mockResolvedValue({ id: 'market-1' });
    await service.update('market-1', { name: ' 新市场 ', cityId: 'city-2' });
    expect(prisma.market.update).toHaveBeenCalledWith({
      where: { id: 'market-1' },
      data: { name: '新市场', city: { connect: { id: 'city-2' } } },
      include: { city: true },
    });
  });

  it('rejects a duplicate market name on update', async () => {
    prisma.market.findFirst
      .mockResolvedValueOnce({ id: 'market-1', name: 'Old', cityId: 'city-1' })
      .mockResolvedValueOnce({ id: 'existing' });
    await expect(service.update('market-1', { name: 'New' })).rejects.toThrow(ConflictException);
  });

  it('soft deletes a market with no linked orders', async () => {
    prisma.market.findFirst.mockResolvedValue({ id: 'market-1' });
    prisma.order.count.mockResolvedValue(0);
    prisma.market.update.mockResolvedValue({});
    await expect(service.delete('market-1')).resolves.toEqual({ success: true, data: null });
    expect(prisma.market.update).toHaveBeenCalledWith({
      where: { id: 'market-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('rejects deleting a market used by orders', async () => {
    prisma.market.findFirst.mockResolvedValue({ id: 'market-1' });
    prisma.order.count.mockResolvedValue(1);
    await expect(service.delete('market-1')).rejects.toThrow(ConflictException);
  });
});
