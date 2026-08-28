import { ConflictException, NotFoundException } from '@nestjs/common';
import { PurchasePlaceService } from '../purchase-place.service';

describe('PurchasePlaceService', () => {
  const prisma = {
    purchasePlace: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    market: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new PurchasePlaceService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it('returns purchase places filtered by keyword', async () => {
    prisma.purchasePlace.findMany.mockResolvedValue([{ id: 'place-1' }]);
    prisma.purchasePlace.count.mockResolvedValue(1);
    await expect(service.findAll(2, 10, '晋城')).resolves.toEqual({
      items: [{ id: 'place-1' }],
      meta: { page: 2, pageSize: 10, total: 1 },
    });
    expect(prisma.purchasePlace.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: expect.objectContaining({ OR: expect.any(Array) }),
    }));
  });

  it('throws when the purchase place is missing', async () => {
    prisma.purchasePlace.findFirst.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });

  it('creates a unique purchase place with trimmed values', async () => {
    prisma.purchasePlace.findFirst.mockResolvedValue(null);
    prisma.purchasePlace.create.mockResolvedValue({ id: 'place-1' });
    await service.create({ place: ' 晋城 ', description: ' 主产区 ' });
    expect(prisma.purchasePlace.create).toHaveBeenCalledWith({
      data: { place: '晋城', description: '主产区' },
    });
  });

  it('rejects a duplicate purchase place on create', async () => {
    prisma.purchasePlace.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create({ place: '晋城' })).rejects.toThrow(ConflictException);
  });

  it('updates place and description', async () => {
    prisma.purchasePlace.findFirst
      .mockResolvedValueOnce({ id: 'place-1', place: 'Old' })
      .mockResolvedValueOnce(null);
    prisma.purchasePlace.update.mockResolvedValue({ id: 'place-1' });
    await service.update('place-1', { place: ' 郑州 ', description: ' ' });
    expect(prisma.purchasePlace.update).toHaveBeenCalledWith({
      where: { id: 'place-1' },
      data: { place: '郑州', description: null },
    });
  });

  it('rejects a duplicate purchase place on update', async () => {
    prisma.purchasePlace.findFirst
      .mockResolvedValueOnce({ id: 'place-1', place: 'Old' })
      .mockResolvedValueOnce({ id: 'existing' });
    await expect(service.update('place-1', { place: 'New' })).rejects.toThrow(ConflictException);
  });

  it('soft deletes a purchase place with no linked markets', async () => {
    prisma.purchasePlace.findFirst.mockResolvedValue({ id: 'place-1' });
    prisma.market.count.mockResolvedValue(0);
    prisma.purchasePlace.update.mockResolvedValue({});
    await expect(service.delete('place-1')).resolves.toEqual({ success: true, data: null });
    expect(prisma.purchasePlace.update).toHaveBeenCalledWith({
      where: { id: 'place-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('rejects deleting a purchase place used by markets', async () => {
    prisma.purchasePlace.findFirst.mockResolvedValue({ id: 'place-1' });
    prisma.market.count.mockResolvedValue(1);
    await expect(service.delete('place-1')).rejects.toThrow(ConflictException);
  });
});
