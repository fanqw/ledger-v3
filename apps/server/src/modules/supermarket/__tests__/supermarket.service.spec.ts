import { ConflictException, NotFoundException } from '@nestjs/common';
import { SupermarketService } from '../supermarket.service';

describe('SupermarketService', () => {
  const prisma = {
    supermarket: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new SupermarketService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns supermarkets filtered by keyword', async () => {
    prisma.supermarket.findMany.mockResolvedValue([{ id: 'super-1' }]);
    prisma.supermarket.count.mockResolvedValue(1);
    await expect(service.findAll(1, 10, '端氏')).resolves.toEqual({
      items: [{ id: 'super-1' }],
      meta: { page: 1, pageSize: 10, total: 1 },
    });
    expect(prisma.supermarket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 0,
      take: 10,
      where: expect.objectContaining({ OR: expect.any(Array) }),
    }));
  });

  it('throws when the supermarket is missing', async () => {
    prisma.supermarket.findFirst.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });

  it('creates a supermarket with trimmed name', async () => {
    prisma.supermarket.findFirst.mockResolvedValue(null);
    prisma.supermarket.create.mockResolvedValue({ id: 'super-1' });
    await service.create({ name: ' 端氏 ', description: ' 月结客户 ' });
    expect(prisma.supermarket.create).toHaveBeenCalledWith({
      data: { name: '端氏', description: '月结客户' },
    });
  });

  it('rejects a duplicate supermarket name on create', async () => {
    prisma.supermarket.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create({ name: '端氏' })).rejects.toThrow(ConflictException);
  });

  it('updates name and description', async () => {
    prisma.supermarket.findFirst
      .mockResolvedValueOnce({ id: 'super-1', name: 'Old' })
      .mockResolvedValueOnce(null);
    prisma.supermarket.update.mockResolvedValue({ id: 'super-1' });
    await service.update('super-1', { name: ' 嘉峰 ', description: ' ' });
    expect(prisma.supermarket.update).toHaveBeenCalledWith({
      where: { id: 'super-1' },
      data: { name: '嘉峰', description: null },
    });
  });

  it('rejects a duplicate supermarket name on update', async () => {
    prisma.supermarket.findFirst
      .mockResolvedValueOnce({ id: 'super-1', name: 'Old' })
      .mockResolvedValueOnce({ id: 'existing' });
    await expect(service.update('super-1', { name: 'New' })).rejects.toThrow(ConflictException);
  });

  it('soft deletes a supermarket directly (no reference check)', async () => {
    prisma.supermarket.findFirst.mockResolvedValue({ id: 'super-1' });
    prisma.supermarket.update.mockResolvedValue({});
    await expect(service.delete('super-1')).resolves.toEqual({ success: true, data: null });
    expect(prisma.supermarket.update).toHaveBeenCalledWith({
      where: { id: 'super-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
