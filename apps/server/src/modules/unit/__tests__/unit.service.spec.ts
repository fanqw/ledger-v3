import { ConflictException, NotFoundException } from '@nestjs/common';
import { UnitService } from '../unit.service';

describe('UnitService', () => {
  const prisma = {
    unit: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    commodity: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new UnitService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it('returns paginated units filtered by keyword', async () => {
    prisma.unit.findMany.mockResolvedValue([{ id: 'unit-1' }]);
    prisma.unit.count.mockResolvedValue(1);

    await expect(service.findAll(2, 10, 'kg')).resolves.toEqual({
      items: [{ id: 'unit-1' }],
      meta: { page: 2, pageSize: 10, total: 1 },
    });
    expect(prisma.unit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: expect.objectContaining({ OR: expect.any(Array) }),
    }));
  });

  it('throws when a unit does not exist', async () => {
    prisma.unit.findFirst.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });

  it('trims values when creating a unique unit', async () => {
    prisma.unit.findFirst.mockResolvedValue(null);
    prisma.unit.create.mockResolvedValue({ id: 'unit-1' });

    await service.create({ name: ' kg ', description: ' weight ' });
    expect(prisma.unit.create).toHaveBeenCalledWith({
      data: { name: 'kg', description: 'weight' },
    });
  });

  it('rejects a duplicate unit name on create', async () => {
    prisma.unit.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create({ name: 'kg' })).rejects.toThrow(ConflictException);
  });

  it('updates an existing unit', async () => {
    prisma.unit.findFirst
      .mockResolvedValueOnce({ id: 'unit-1' })
      .mockResolvedValueOnce(null);
    prisma.unit.update.mockResolvedValue({ id: 'unit-1' });

    await service.update('unit-1', { name: ' box ', description: ' ' });
    expect(prisma.unit.update).toHaveBeenCalledWith({
      where: { id: 'unit-1' },
      data: { name: 'box', description: null },
    });
  });

  it('rejects a duplicate unit name on update', async () => {
    prisma.unit.findFirst
      .mockResolvedValueOnce({ id: 'unit-1' })
      .mockResolvedValueOnce({ id: 'existing' });
    await expect(service.update('unit-1', { name: 'kg' })).rejects.toThrow(ConflictException);
  });

  it('soft deletes a unit with no linked commodities', async () => {
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' });
    prisma.commodity.count.mockResolvedValue(0);
    prisma.unit.update.mockResolvedValue({});

    await expect(service.delete('unit-1')).resolves.toEqual({ success: true, data: null });
    expect(prisma.unit.update).toHaveBeenCalledWith({
      where: { id: 'unit-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('rejects deleting a unit used by commodities', async () => {
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' });
    prisma.commodity.count.mockResolvedValue(1);
    await expect(service.delete('unit-1')).rejects.toThrow(ConflictException);
  });
});
